import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('saas')
  @HttpCode(200)
  async extractSaaS(@Body('text') text: string) {
    return this.appService.callSaaS(text);
  }

  @Post('vertex')
  @HttpCode(200)
  async extractVertex(@Body('text') text: string) {
    return this.appService.callVertex(text);
  }
}
