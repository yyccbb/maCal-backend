import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiParserService } from './ai-parser.service';
import { ParseScheduleTextDto } from './dto/parse-schedule-text.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiParserController {
  constructor(private readonly aiParserService: AiParserService) {}

  @Post('parse-schedule-text')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  parseScheduleText(@Body() dto: ParseScheduleTextDto) {
    return this.aiParserService.parse({
      text: dto.text,
      timezone: dto.timezone,
      locale: dto.locale ?? 'en',
    });
  }
}
