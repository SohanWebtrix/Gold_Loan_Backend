import { Module } from '@nestjs/common';
import { MortgagedController } from './mortgaged.controller';
import { MortgagedService } from './mortgaged.service';

@Module({
  controllers: [MortgagedController],
  providers: [MortgagedService]
})
export class MortgagedModule {}
