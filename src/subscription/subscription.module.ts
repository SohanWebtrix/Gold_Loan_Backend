/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { DatabaseModule } from 'src/database/database.module';
import { SubscriptionRepository } from './subscription.repository/subscription.repository';

@Module({
    imports: [DatabaseModule],
  
  controllers: [SubscriptionController],
  providers: [SubscriptionService,SubscriptionRepository],
  exports:[]
})
export class SubscriptionModule {}
