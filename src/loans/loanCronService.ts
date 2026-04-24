/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class LoanCronService {
    constructor(private readonly db: DatabaseService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async markOverdueLoans() {
        await this.db.query(`
      UPDATE loans
      SET loan_status = 'overdue'
      WHERE due_date < CURDATE()
      AND loan_status = 'active'
    `);

        console.log('Overdue loans updated');
    }
}

