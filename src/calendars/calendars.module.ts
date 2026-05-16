import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { CalendarsController } from './calendars.controller';
import { CalendarsService } from './calendars.service';

@Module({
  imports: [SyncModule],
  controllers: [CalendarsController],
  providers: [CalendarsService],
})
export class CalendarsModule {}
