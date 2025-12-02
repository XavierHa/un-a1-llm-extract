import { Injectable } from '@nestjs/common';
import { Mistral } from '@mistralai/mistralai';
import { GoogleAuth } from 'google-auth-library';
import { ConfigService } from './config.service';

@Injectable()
export class AppService {
  private mistralClient: Mistral;
  private googleAuth: GoogleAuth;
  private projectId = 'random-unnest'; // Hardcoded for PoC
  private location = 'europe-west4';

  constructor(private configService: ConfigService) {
    // API Key is injected from Secret Manager into env var
    this.mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    this.googleAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  }

  private cleanPii(text: string): string {
    return text
      .replace(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g, "[PHONE]")
      .replace(/[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g, "[EMAIL]");
  }

  async callSaaS(rawText: string) {
    const safeText = this.cleanPii(rawText);
    const start = Date.now();

    try {
      const result = await this.mistralClient.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: this.configService.getCombinedPrompt() },
          { role: 'user', content: safeText }
        ],
        responseFormat: { type: 'json_object' },
        temperature: 0.1
      });

      return {
        provider: 'MISTRAL_SAAS',
        duration: `${Date.now() - start}ms`,
        data: JSON.parse(result.choices[0].message.content as string)
      };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async callVertex(rawText: string) {
    const safeText = this.cleanPii(rawText);
    const start = Date.now();
    const modelId = 'mistral-small-2503';

    try {
      const client = await this.googleAuth.getClient();
      const accessToken = await client.getAccessToken();
      const url = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/mistralai/models/${modelId}:rawPredict`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: this.configService.getCombinedPrompt() },
            { role: 'user', content: safeText }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) throw new Error(await response.text());
      
      const json = await response.json();
      let content = json.choices[0].message.content;
      
      // Clean Vertex Markdown
      if (typeof content === 'string') {
        content = content.replace(/```json\n|\n```/g, '').trim();
      }

      return {
        provider: 'VERTEX_AI',
        duration: `${Date.now() - start}ms`,
        data: JSON.parse(content)
      };

    } catch (e: any) {
      return { error: e.message };
    }
  }
}
