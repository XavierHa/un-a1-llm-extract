import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  BadRequestException,
} from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Endpoint: POST /student or POST /mentor
  @Post(":taskId")
  @HttpCode(200)
  async extract(
    @Param("taskId") taskId: string,
    @Body("text") text: string,
    @Body("provider") provider?: "saas" | "vertex", // Optional param
  ) {
    if (!text) {
      throw new BadRequestException('Field "text" is required in body');
    }

    // Default to 'saas' if not specified
    const selectedProvider = provider || "saas";

    return this.appService.process(taskId, text, selectedProvider);
  }
}
