import { Module } from '@nestjs/common';
import { AiParserController } from './ai-parser.controller';
import { AiParserService } from './ai-parser.service';
import { LlmScheduleParserProvider } from './providers/llm-schedule-parser.provider';
import { RuleBasedScheduleParserProvider } from './providers/rule-based-schedule-parser.provider';

@Module({
  controllers: [AiParserController],
  providers: [AiParserService, RuleBasedScheduleParserProvider, LlmScheduleParserProvider],
  exports: [AiParserService],
})
export class AiParserModule {}
