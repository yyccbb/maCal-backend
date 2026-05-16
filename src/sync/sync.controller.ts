import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get()
  getChanges(
    @CurrentUser() user: AuthUser,
    @Query('sinceVersion', new DefaultValuePipe(0), ParseIntPipe) sinceVersion: number,
  ) {
    return this.syncService.getChanges(user.id, sinceVersion);
  }
}
