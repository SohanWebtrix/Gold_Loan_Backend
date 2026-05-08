/* eslint-disable prettier/prettier */
import { InternalServerErrorException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import * as Sentry from '@sentry/node';
import { ResultSetHeader } from "mysql2";


export class SettingRepository {

    constructor(private readonly db: DatabaseService) { }


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
                    UPDATE prefix
                    SET ${fields.join(', ')}
                    WHERE prefix_id = ?
                  `;

            values.push(prefixid);

            const [result] = await this.db.query(
                sql,
                values,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ updateNominee error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to update Nominee',
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
