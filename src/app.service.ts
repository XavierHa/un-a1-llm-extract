import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { Mistral } from "@mistralai/mistralai";
import { GoogleAuth } from "google-auth-library";
import { ConfigService } from "./config.service";

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private mistralClient: Mistral;
  private googleAuth: GoogleAuth;

  // Vertex Config
  private projectId = "random-unnest";
  private location = "eureope-west4"; // US for model availability
  private vertexModelId = "mistral-small-2503";

  constructor(private configService: ConfigService) {
    this.mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    this.googleAuth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }

  // --- MAIN ENTRY POINT ---
  async process(taskId: string, rawText: string, provider: "saas" | "vertex") {
    const start = Date.now();

    // 1. Prepare Data
    const piiStart = Date.now();
    const safeText = this.cleanPii(rawText);
    const piiTime = Date.now() - piiStart;

    const promptStart = Date.now();
    const systemPrompt = this.configService.getCombinedPrompt(taskId);
    const promptTime = Date.now() - promptStart;

    const partialTiming = {
      start_ts: start,
      pii_scrubbing_ms: piiTime,
      prompt_construction_ms: promptTime,
    };

    try {
      // 2. Route to the correct provider
      if (provider === "vertex") {
        return await this.callVertex(
          systemPrompt,
          safeText,
          taskId,
          partialTiming,
        );
      } else {
        return await this.callSaaS(
          systemPrompt,
          safeText,
          taskId,
          partialTiming,
        );
      }
    } catch (e: any) {
      this.logger.error(`Task ${taskId} failed on ${provider}: ${e.message}`);
      throw new InternalServerErrorException(e.message);
    }
  }

  // --- PROVIDER A: MISTRAL SAAS ---
  private async callSaaS(
    systemPrompt: string,
    userText: string,
    taskId: string,
    partialTiming: any,
  ) {
    const apiStart = Date.now();
    const result = await this.mistralClient.chat.complete({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      responseFormat: { type: "json_object" },
      temperature: 0.1,
    });
    const apiTime = Date.now() - apiStart;
    const totalTime = Date.now() - partialTiming.start_ts;

    return {
      task_id: taskId,
      provider: "MISTRAL_SAAS",
      duration: `${totalTime}ms`,
      data: JSON.parse(result.choices[0].message.content as string),
      timing: {
        ...partialTiming,
        external_api_call_ms: apiTime,
        total_processing_ms: totalTime,
      },
    };
  }

  // --- PROVIDER B: VERTEX AI ---
  private async callVertex(
    systemPrompt: string,
    userText: string,
    taskId: string,
    partialTiming: any,
  ) {
    const apiStart = Date.now();
    const client = await this.googleAuth.getClient();
    const accessToken = await client.getAccessToken();

    const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/mistralai/models/${this.vertexModelId}:rawPredict`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.vertexModelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Vertex API Error: ${response.status} - ${errText}`);
    }

    const json = await response.json();
    const apiTime = Date.now() - apiStart;
    let content = json.choices[0].message.content;

    // Clean Vertex Markdown (```json ... ```)
    if (typeof content === "string") {
      content = content.replace(/```json\n|\n```/g, "").trim();
    }
    const totalTime = Date.now() - partialTiming.start_ts;

    return {
      task_id: taskId,
      provider: "GOOGLE_VERTEX_AI",
      duration: `${totalTime}ms`,
      data: JSON.parse(content),
      timing: {
        ...partialTiming,
        external_api_call_ms: apiTime,
        total_processing_ms: totalTime,
      },
    };
  }

  private cleanPii(text: string): string {
    return text
      .replace(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g, "[PHONE]")
      .replace(/[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g, "[EMAIL]");
  }
}
