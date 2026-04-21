import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { DatabaseModule } from 'src/database/database.module';
import { LoanRepository } from './loan.repository/loan.repository';
import { CommonModule } from 'src/common/common.module';
import { CustomersModule } from 'src/customers/customers.module';

@Module({
  imports: [DatabaseModule, CommonModule, CustomersModule],
  controllers: [LoansController],
  providers: [LoansService, LoanRepository],
})
export class LoansModule {}
