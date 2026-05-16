/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import { DatabaseService } from 'src/database/database.service';
import { LoanRepository } from './loan.repository/loan.repository';

@Injectable()
export class LoanCronService {
  constructor(private readonly db: DatabaseService, private readonly loanRepo: LoanRepository,
  ) { }

  @Cron(CronExpression.EVERY_HOUR) async markOverdueLoans() {
    console.log('Cron running...');

    await this.db.query(`
      UPDATE loans
      SET loan_status = 'overdue'
      WHERE due_date < CURDATE()
      AND loan_status = 'active'
    `);

  }



  @Cron(CronExpression.EVERY_MINUTE)

  async calculateDailyInterest() {

    console.log('Daily interest cron started');

    const today =
      DateTime.now()
        .setZone('Asia/Kolkata')
        .toISODate();

    const loans =
      await this.loanRepo.getActiveLoans();



    for (const loan of loans) {

      try {

        const principal =
          Number(loan.principal_balance);

        const yearlyRate =
          Number(loan.interest_rate);

        // skip fully paid loans
        if (principal <= 0) {
          continue;
        }

        const dailyInterest = Number(
          (
            (
              principal *
              yearlyRate
            ) / 365 / 100
          ).toFixed(2)
        );

        // =====================================
        // INSERT DAILY SNAPSHOT
        // =====================================

        const newAccruedInterest =
          Number(
            (
              Number(loan.accrued_interest)
              + dailyInterest
            ).toFixed(2)
          );

        const newTotalAmount =
          principal + newAccruedInterest

        await this.db.transaction(async (conn) => {

          // update loan table


          // insert daily snapshot
          const result: any =
            await this.loanRepo.insertDailyInterest(
              {

                loan_id: loan.loan_id,

                interest_date:
                  today,

                daily_interest:
                  dailyInterest,

                accrued_interest:
                  newAccruedInterest,

              },
              conn,
            );

          if (result[0].affectedRows === 0) {

            return;
          }

          await this.loanRepo.updateLoanInterest(
            loan.loan_id,
            {
              accrued_interest:
                newAccruedInterest,
              total_amount: newTotalAmount,
              last_interest_date:today,
            },
            conn
          );

        })

      } catch (error) {

        console.error(
          `Interest cron failed for loan ${loan.loan_id}`,
          error
        );
      }
    }

    console.log('Daily interest cron completed');
  }

}
