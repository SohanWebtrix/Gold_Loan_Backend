import { Module } from '@nestjs/common';
import { LedureController } from './ledure.controller';
import { LedureService } from './ledure.service';
import { DatabaseModule } from 'src/database/database.module';
import { LedureRepository } from './ledure.repository/ledure.repository';

@Module({
  controllers: [LedureController],
  providers: [LedureService, LedureRepository],
  imports: [DatabaseModule],
  exports: [],
})
export class LedureModule {}
