import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface TaskConfig {
  taxonomy: any;
  systemPrompt: string;
}

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  // Store configs in a Map: 'student' -> { prompt, taxonomy }
  private taskConfigs = new Map<string, TaskConfig>();

  onModuleInit() {
    this.loadConfiguration();
  }

  private loadConfiguration() {
    try {
      const rootDir = path.resolve(__dirname, "..");
      const configBaseDir = path.join(rootDir, "config");

      this.logger.log(`Scanning config directory: ${configBaseDir}`);

      // 1. Get all sub-directories in /config
      if (!fs.existsSync(configBaseDir))
        throw new Error(`Config dir missing at ${configBaseDir}`);

      const tasks = fs
        .readdirSync(configBaseDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      if (tasks.length === 0)
        this.logger.warn("No tasks found in config directory!");

      // 2. Loop through each folder (student, mentor...) and load files
      for (const task of tasks) {
        const taskDir = path.join(configBaseDir, task);
        const taxonomyPath = path.join(taskDir, "taxonomy.json");
        const promptPath = path.join(taskDir, "system_prompt.txt");

        // Validate existence
        if (!fs.existsSync(taxonomyPath) || !fs.existsSync(promptPath)) {
          this.logger.warn(
            `Skipping task '${task}': missing taxonomy.json or system_prompt.txt`,
          );
          continue;
        }

        // Load content
        const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf-8"));
        const systemPrompt = fs.readFileSync(promptPath, "utf-8");

        this.taskConfigs.set(task, { taxonomy, systemPrompt });
        this.logger.log(`✅ Loaded config for task: '${task}'`);
      }
    } catch (error) {
      this.logger.error(`❌ FATAL: Configuration Logic Error.`);
      this.logger.error(error.message);
      process.exit(1);
    }
  }

  // Retrieve the specific config for the requested ID
  getTaskConfig(taskId: string): TaskConfig {
    const config = this.taskConfigs.get(taskId);
    if (!config) {
      throw new NotFoundException(
        `Task configuration '${taskId}' not found. Available: [${Array.from(this.taskConfigs.keys()).join(", ")}]`,
      );
    }
    return config;
  }

  // Helper to build the full prompt string
  getCombinedPrompt(taskId: string) {
    const config = this.getTaskConfig(taskId);
    return `
    ${config.systemPrompt}

    === TAXONOMY LISTS (STRICT MAPPING REQUIRED) ===
    ${JSON.stringify(config.taxonomy, null, 2)}

    OUTPUT FORMAT: JSON ONLY.
    `;
  }
}
