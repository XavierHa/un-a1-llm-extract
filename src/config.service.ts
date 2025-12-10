import { Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  public taxonomy: string[] = [];
  public systemPrompt: string = "";

  constructor() {
    this.loadConfiguration();
  }

  private loadConfiguration() {
    try {
      // 1. Resolve Paths
      // In Docker, 'dist' is the root, so we go up one level to find 'config'
      const rootDir = path.resolve(__dirname, "..");
      const taxonomyPath = path.join(rootDir, "config", "taxonomy.json");
      const promptPath = path.join(rootDir, "config", "system_prompt.txt");

      this.logger.log(`Loading config from: ${rootDir}/config`);

      // 2. Load and Validate Taxonomy (JSON)
      if (!fs.existsSync(taxonomyPath))
        throw new Error(`Taxonomy file missing at ${taxonomyPath}`);
      const taxonomyRaw = fs.readFileSync(taxonomyPath, "utf-8");
      this.taxonomy = JSON.parse(taxonomyRaw); // 💥 THROWS if JSON is bad

      if (!Array.isArray(this.taxonomy))
        throw new Error("Taxonomy must be a JSON Array");

      // 3. Load System Prompt (Text)
      if (!fs.existsSync(promptPath))
        throw new Error(`Prompt file missing at ${promptPath}`);
      this.systemPrompt = fs.readFileSync(promptPath, "utf-8");

      this.logger.log(
        `✅ Configuration loaded. ${this.taxonomy.length} sectors loaded.`,
      );
    } catch (error) {
      this.logger.error(`❌ FATAL: Configuration Error. Deployment rejected.`);
      this.logger.error(error.message);
      // 🛑 SAFETY NET: Kill the app immediately.
      // Cloud Run will detect this crash during deployment and cancel the rollout.
      process.exit(1);
    }
  }

  getCombinedPrompt() {
    return `
      ${this.systemPrompt}

      === TAXONOMY LISTS (STRICT MAPPING REQUIRED) ===
      ${JSON.stringify(this.taxonomy, null, 2)}

      output valid JSON only.
      `;
  }
}
