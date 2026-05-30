/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';

@Injectable()
export class SubscriptionCronService {

  constructor(private readonly db: any) {}

  // Run every day at IST midnight
  @Cron('0 0 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async expireSubscriptions() {

    try {

      // today's date in IST
      const indiaDate = DateTime.now()
        .setZone('Asia/Kolkata')
        .toFormat('yyyy-MM-dd');

      await this.db.query(
        `
        UPDATE customers
        SET
          subscription_status = 'inactive',
          status = 'inactive'
        WHERE subscription_end_date < ?
        AND subscription_status != 'inactive'
        `,
        [indiaDate]
      );

   

    } catch (error) {
      console.error(
        'expireSubscriptions error',
        error
      );
    }
  }
}