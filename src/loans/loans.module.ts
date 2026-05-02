import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { DatabaseModule } from 'src/database/database.module';
import { LoanRepository } from './loan.repository/loan.repository';
import { TransactionRepository } from 'src/transactions/transaction.repository/transaction.repository';
import { LedureRepository } from 'src/ledure/ledure.repository/ledure.repository';
import { CommonModule } from 'src/common/common.module';
import { CustomersModule } from 'src/customers/customers.module';
import { LoanCronService } from './loanCronService';

@Module({
  imports: [DatabaseModule, CommonModule, CustomersModule],
  controllers: [LoansController],
  providers: [LoansService, LoanRepository, TransactionRepository, LedureRepository, LoanCronService],
})
export class LoansModule {}
