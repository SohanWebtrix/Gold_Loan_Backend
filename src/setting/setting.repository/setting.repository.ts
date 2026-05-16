/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import * as Sentry from '@sentry/node';
import { ResultSetHeader } from "mysql2";
import { DateTime } from "luxon";
import * as bcrypt from 'bcrypt';

export type PrefixItem = {
    module: string;
    prefix: string;
    year: string | number;
    document_no: string | number;
};

@Injectable()

export class SettingRepository {

    constructor(private readonly db: DatabaseService) { }

       async getPrefixesByCompany(companyId: number): Promise<any> {

            const rows = await this.db.query(
                `
          SELECT
          *
          FROM prefix_table
          WHERE company_id = ?
          `,
                [companyId],
            );
    
            return rows;

        }

        async getCompanyById(companyId: number) {
  
    try {
    const rows = await this.db.query(
      `SELECT * FROM company
       WHERE company_id = ?
       LIMIT 1`,
      [companyId],
    );

    return rows[0] || null;
  } 
  
  catch (error) {
    console.error('getCompanyById error', error);
    throw error;
  }
}


     async updateStaff(staffId: number, data: any, userId: number) {
    
            try {
                
                const payload: Record<string, any> = { ...data };
    
                if (payload.cust_password !== undefined) {
                    payload.cust_password = payload.cust_password
                        ? await bcrypt.hash(payload.cust_password, 10)
                        : null;
                }
    
                if (payload.first_name !== undefined || payload.last_name !== undefined) {
                    const first = payload.first_name ?? '';
                    const last = payload.last_name ?? '';
                    const computedName = [first, last].filter(Boolean).join(' ').trim();
                    if (computedName) {
                        payload.cust_name = computedName;
                    }
                }
    
                const filteredPayload = Object.fromEntries(
                    Object.entries(payload).filter(([, value]) => value !== undefined),
                );
    
                if (!Object.keys(filteredPayload).length) {
                    throw new Error('Nothing to update');
                }
    
                filteredPayload.modified_by = userId;
                filteredPayload.modified_date = DateTime.now()
                    .toUTC()
                    .toFormat('yyyy-MM-dd HH:mm:ss');
    
                const fields = Object.keys(filteredPayload);
                const setClause = fields.map((field) => `${field} = ?`).join(', ');
                const values = fields.map((field) => filteredPayload[field]);
    
                const sql = `
                UPDATE customers
                SET ${setClause}
                WHERE customer_id = ?
                `;
    
                const result = await this.db.query(sql, [...values, staffId]);
    
                return result;
            } catch (error) {
                console.error('update user error', error);
                throw error;
            }
        }


        async getProfile(customerid: number) {

        try {
            const rows = await this.db.query(
                `SELECT * from customers where customer_id=?
             `, [customerid]
            );
            return rows[0];
        }
        catch (error) {
            console.error("get customer by id error is", error);
            throw error;
        }
    }

    

         async getCompanyDetail(companyId: number)
          {
            

        try {

            const rows = await this.db.query(
                `SELECT * from company where company_id=?
             `, [companyId]
            );

            return rows[0];

        }
        catch (error) {
            console.error("get customer by id error is", error);
            throw error;
        }
    }



    async insertprefixbulk(
        prefix: any[],
        comapny_id: number) {


        try {
            if (!prefix?.length) return;

            const values = prefix.map((item) => [
                comapny_id,
                item.module,
                item.prefix,
                item.year,
                item.document_no,
            ]);

            const sql = `
                  INSERT INTO prefix_table (
                    company_id,
                    doc_type,
                    prefix,
                    year,
                    last_no
                  )
                  VALUES ?
                `;

            const result = await this.db.bulkQuery(sql, [values]);

            return result;

        } catch (error: any) {

            Sentry.captureException(error);

            console.error(
                "❌ insertPrefix Bulk DB error:",
                error,
            );

            throw new InternalServerErrorException(
                "Failed to insert prefix",
            );
        }
    }


    async updatePrefix(
        prefixid: number,
        data: any,
    ) {

        try {

            // clone object
            const payload = { ...data };


            // convert undefined => null
            Object.keys(payload).forEach((key) => {
                if (payload[key] === undefined) {
                    payload[key] = null;
                }
            });

            const fields: string[] = [];
            const values: any[] = [];

            Object.keys(payload).forEach((key) => {
                fields.push(`${key} = ?`);
                values.push(payload[key]);
            });

            if (!fields.length) {
                return;
            }

            const sql = `
                    UPDATE prefix_table
                    SET ${fields.join(', ')}
                    WHERE id = ?
                  `;

            values.push(prefixid);

            const result = await this.db.query(
                sql,
                values,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ update prefix error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to update prefix',
            );
        }
    }


      async updateComapny(
        dto: any,
        comapnyid: number,
        userid: number,
    ) {

        // merge dto + file paths
        try {

            const updateData = {
                ...dto };


            // ✅ convert undefined → null
            Object.keys(updateData).forEach((key) => {
                if (updateData[key] === undefined) {
                    updateData[key] = null;
                }
            });


            const { modified_date, ...restDto } = updateData;


            const fields = Object.keys(restDto);

            if (!fields.length && !modified_date) {
                return {
                    affectedRows: 0,
                    changedRows: 0,
                } as ResultSetHeader;
            }

            let setClause = fields.map((f) => `${f} = ?`).join(', ');
            const values = Object.values(restDto);

            // 7. Always set modified_date (local timezone, not NOW())
            if (modified_date) {
                setClause += `${setClause ? ', ' : ''}modified_date = ?`;
                values.push(modified_date);
            }


            // 8. Always set modified_by
            setClause += `, modified_by = ?`;
            values.push(userid);


            const sql = `
        UPDATE company
        SET ${setClause}
        WHERE company_id = ?
      `;

            const result = await this.db.query<ResultSetHeader>(sql, [...values, comapnyid]);

            return result;

        }
        catch (error) {
            Sentry.captureException(error);

            console.error("Client update error is", error);

            throw error;
        }

    }


}
