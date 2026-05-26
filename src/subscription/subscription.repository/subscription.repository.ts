/* eslint-disable prettier/prettier */

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ResultSetHeader } from "mysql2";
import { DatabaseService } from "src/database/database.service";
import * as Sentry from '@sentry/node';
import { OPERATOR_SQL } from "src/filter/operator.map";
import { DateTime } from "luxon";
import * as bcrypt from 'bcrypt';




@Injectable()
export class SubscriptionRepository {

  constructor(private readonly db: DatabaseService) {

  }


  async getSearchClient(page: number, limit: number, search: string, userid: number) {
    try {

      const rows: any = await this.db.query(
        `SELECT customer_id,concat(first_name,' ',last_name) as full_name FROM customers 
           WHERE CONCAT(first_name, ' ', last_name) LIKE ?`,
        [`%${search}%`],
      );

      return rows;

    } catch (error) {

      Sentry.captureException(error);

      console.error('getCustomer by name error', error);

      throw error;

    }
  }

  async getFilteredCountSearch(search: string, userid: number): Promise<number> {
    try {
      const rows = await this.db.query<number>(
        `SELECT COUNT(*) as total  FROM customers 
            WHERE CONCAT(first_name, ' ', last_name) LIKE ?`,
        [`%${search}%`],
      );


      return rows[0].total;

    }

    catch (error) {
      Sentry.captureException(error);

      console.error("getTotalCount error is", error)
      throw error;
    }
  }



  async getSubDetails(subid: number) {

    try {
      const rows = await this.db.query(
        `SELECT * from subscription_table where sub_id=?
                 `, [subid]
      );

      return rows;
    }
    catch (error) {
      Sentry.captureException(error);

      console.error("get subscription error is", error);
      throw error;
    }
  }


  async getSubDetailsforcustomer(id: number) {

    try {
      const customer = await this.db.query(
        `SELECT * from customers where customer_id=?
                 `, [id]
      );

      console.log("customer is",customer);

      const customerId = customer[0]?.customer_id;
       const subscriptionlist: any = await this.db.query(`select * from subscription_table where customer_id=?`,[customerId]);

       return{
        customer,
        subscriptionlist,
       }

    }
    catch (error) {

      Sentry.captureException(error);

      console.error("get subscription error is", error);
      
      throw error;
    }
  }

  async getSubsByid(subid: number) {
    try {
      const rows = await this.db.query(
        'SELECT * FROM subscription_table WHERE sub_id = ? LIMIT 1',
        [subid],
      );
      return rows[0] || null;
    } catch (error) {
      Sentry.captureException(error);

      console.error('getStaffById error', error);
      throw error;
    }
  }

  async updateSubs(subid: number, data: any, userId: number, conn: any) {

    try {

      const db = conn ?? this.db;

      const payload: Record<string, any> = { ...data };

      console.log("payload in updatSubs is", payload);

      const filteredPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined && value !== 'undefined'
        ),
      );

      console.log("filtered payload is", filteredPayload);

      if (!Object.keys(filteredPayload).length) {
        throw new Error('Nothing to update');
      }

      filteredPayload.modified_by = userId;
      filteredPayload.modified_date = DateTime.now()
        .setZone('Asia/Kolkata')
        .toFormat('yyyy-MM-dd HH:mm:ss');

      const fields = Object.keys(filteredPayload);
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => filteredPayload[field]);

      const sql = `
                UPDATE subscription_table
                SET ${setClause}
                WHERE sub_id = ?
                `;

      const [result] = await db.query(sql, [...values, subid]);

      return result;
    } catch (error) {
      Sentry.captureException(error);

      console.error('updateStaff error', error);
      throw error;
    }
  }


  async updateCustomer(
    data: any,
    conn?: any,
  ) {

    try {
      const db = conn ?? this.db;

      return db.query(
        `
        UPDATE customers
        SET
          subscription_end_date = ?
        WHERE customer_id = ?
        `,
        [
          data.subscription_end_date,
          data.customer_id,
        ]
      );
    }
    catch (error) {
      Sentry.captureException(error);

    }

  }

  async updateFilesPath(subscriptid: number, files: any) {

    try {
      const fields: string[] = [];
      const values: any[] = [];

      Object.keys(files).forEach((key) => {
        if (files[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(files[key]);
        }
      });

      if (fields.length === 0) {
        return;
      }

      const sql = `
                 UPDATE subscription_table
                  SET ${fields.join(', ')}
                  WHERE sub_id = ?
                `;

      values.push(subscriptid);

      const result = await this.db.query<ResultSetHeader>(sql, values);

      return result;

    } catch (error) {
      Sentry.captureException(error);

      console.error('updateStaff error', error);
      throw error;

    }
  }



  async insertSubscription(
    data: any,
    userId: number,
    customerId: number,
    conn: any
  ) {
    try {

      const db = conn ?? this.db;

      console.log("data in insertLoan is", data);

      const payload: any = {
        ...data,
        created_by: userId,
        customer_id: customerId
      };


      delete payload.nominees;
      delete payload.mortgaged_items;
      delete payload.payments;


      Object.keys(payload).forEach(key => {

        if (payload[key] === undefined) {
          payload[key] = null;
        }

      });

      const columns = Object.keys(payload).join(", ");
      const placeholders = Object.keys(payload).map(() => "?").join(", ");
      const values = Object.values(payload);

      console.log(payload.loan_document_number);
      console.log(payload);
      console.log("columns", columns);
      console.log("values", values);


      const [result] = await db.query(
        `INSERT INTO subscription_table (${columns}) VALUES (${placeholders})`,
        values
      );

      return result;

    } catch (error: any) {

      Sentry.captureException(error);

      console.error("❌ insert Subscription DB error:", error);


      throw new InternalServerErrorException(
        "Failed to create subscription"
      );
    }
  }

  async deleteSubscription(subscriptid: number) {
    try {
      const result = await this.db.query(
        'DELETE FROM subscription_table WHERE sub_id = ?',
        [subscriptid],
      );
      return result;
    } catch (error) {
      Sentry.captureException(error);

      console.error('delete subscription error is', error);
      throw error;
    }
  }


  async getSubscriptionTotalCount(): Promise<number> {
    try {
      const rows = await this.db.query(
        `
      SELECT COUNT(*) as total
      FROM subscription_table
      `);

      return rows[0]?.total ?? 0;
    } catch (error) {
      Sentry.captureException(error);

      console.error(
        'getSubscriptionTotalCount error',
        error,
      );

      throw error;
    }
  }


  async findAllSubscriptions(
    page: number,
    limit: number,
  ) {
    try {
      const safeLimit = Number(limit);
      const safeOffset = Number(
        (page - 1) * limit,
      );

      const sql = `
      SELECT
        sb.*,
        cs.customer_id,
        cs.first_name,
        cs.last_name,
        cs.cust_name
      FROM subscription_table sb
      LEFT JOIN customers cs
        ON sb.customer_id = cs.customer_id
      ORDER BY sb.sub_id  DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `;

      const rows = await this.db.query(sql);

      return rows;
    } catch (error) {
      Sentry.captureException(error);

      console.error(
        'findAllSubscriptions error',
        error,
      );

      throw error;
    }
  }

  async findSubscriptionWithFilters(
    filters: any[],
    page: number,
    limit: number,
  ) {
    try {
      const where: string[] = [];

      const values: any[] = [];

      filters.forEach((f) => {
        let value = f.value;

        if (f.operator === 'isEmpty') {
          where.push(
            `(${f.column} IS NULL OR ${f.column} = '')`,
          );
          return;
        }

        if (f.operator === 'is_not_empty') {
          where.push(
            `(${f.column} IS NOT NULL AND ${f.column} != '')`,
          );
          return;
        }

        if (f.type === 'date') {
          const startOfDay =
            `${f.value} 00:00:00`;

          const endOfDay =
            `${f.value} 23:59:59`;

          if (f.operator === 'equals') {
            where.push(
              `(${f.column} BETWEEN ? AND ?)`,
            );

            values.push(
              startOfDay,
              endOfDay,
            );

            return;
          }

          if (f.operator === 'before') {
            where.push(
              `${f.column} < ?`,
            );

            values.push(startOfDay);

            return;
          }

          if (f.operator === 'after') {
            where.push(
              `${f.column} > ?`,
            );

            values.push(endOfDay);

            return;
          }

          if (f.operator === 'between') {
            where.push(
              `(${f.column} BETWEEN ? AND ?)`,
            );

            values.push(
              `${f.value} 00:00:00`,
              `${f.valueTo} 23:59:59`,
            );

            return;
          }
        }

        if (f.operator === 'contains')
          value = `%${value}%`;

        if (f.operator === 'starts_with')
          value = `${value}%`;

        if (f.operator === 'ends_with')
          value = `%${value}`;

        if (f.type === 'number')
          value = Number(value);

        where.push(
          `${f.column} ${OPERATOR_SQL[f.operator]} ?`,
        );

        values.push(value);
      });

      const safeLimit = Math.max(
        1,
        Number(limit),
      );

      const safeOffset = Math.max(
        0,
        Number((page - 1) * limit),
      );

      const sql = `
      SELECT
        sb.*,
        cs.customer_id,
        cs.first_name,
        cs.last_name,
        cs.cust_name
      FROM subscription_table sb
      LEFT JOIN customers cs
        ON sb.customer_id = cs.customer_id
      WHERE ${where.join(' AND ')}
      ORDER BY sb.sub_id DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `;

      const rows = await this.db.query(
        sql,
        values,
      );

      return rows;
    } catch (error) {
      Sentry.captureException(error);

      console.error(
        'findSubscriptionWithFilters error',
        error,
      );
    }
  }

  async getSubscriptionFilteredCount(
    filters: any[],
    companyId: number,
  ) {
    try {
      const where: string[] = [];

      const values: any[] = [];

      filters.forEach((f) => {
        let value = f.value;

        if (f.operator === 'isEmpty') {
          where.push(
            `(${f.column} IS NULL OR ${f.column} = '')`,
          );
          return;
        }

        if (f.operator === 'is_not_empty') {
          where.push(
            `(${f.column} IS NOT NULL AND ${f.column} != '')`,
          );
          return;
        }

        if (f.type === 'date') {
          const startOfDay =
            `${f.value} 00:00:00`;
          const endOfDay =
            `${f.value} 23:59:59`;

          if (f.operator === 'equals') {
            where.push(
              `(${f.column} BETWEEN ? AND ?)`,
            );

            values.push(
              startOfDay,
              endOfDay,
            );
            return;
          }

          if (f.operator === 'before') {
            where.push(
              `${f.column} < ?`,
            );
            values.push(startOfDay);
            return;
          }

          if (f.operator === 'after') {
            where.push(
              `${f.column} > ?`,
            );
            values.push(endOfDay);
            return;
          }

          if (f.operator === 'between') {
            where.push(
              `(${f.column} BETWEEN ? AND ?)`,
            );

            values.push(
              `${f.value} 00:00:00`,
              `${f.valueTo} 23:59:59`,
            );

            return;
          }
        }

        if (f.operator === 'contains')
          value = `%${value}%`;

        if (f.operator === 'starts_with')
          value = `${value}%`;

        if (f.operator === 'ends_with')
          value = `%${value}`;

        if (f.type === 'number')
          value = Number(value);

        where.push(
          `${f.column} ${OPERATOR_SQL[f.operator]} ?`,
        );

        values.push(value);
      });

      const sql = `
      SELECT COUNT(*) as total
      FROM subscription_table sb
      LEFT JOIN customers cs
        ON sb.customer_id = cs.customer_id
      WHERE ${where.join(' AND ')}
    `;

      const result = await this.db.query(
        sql,
        values,
      );

      return result[0]?.total ?? 0;
    } catch (error) {
      Sentry.captureException(error);

      console.error(
        'getSubscriptionFilteredCount error',
        error,
      );
    }
  }
}
