/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { DatabaseModule } from 'src/database/database.module';
import { TransactionRepository } from './transaction.repository/transaction.repository';

@Module({
    imports: [DatabaseModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository],
  exports:[TransactionRepository]
})
export class TransactionsModule {}
