import { Module } from '@nestjs/common';
import { SettingController } from './setting.controller';
import { SettingService } from './setting.service';
import { SettingRepository } from './setting.repository/setting.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [SettingController],
  providers: [SettingService, SettingRepository],
  imports:[DatabaseModule]
})
export class SettingModule {}
