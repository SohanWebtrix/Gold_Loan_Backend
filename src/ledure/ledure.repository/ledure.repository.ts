/* eslint-disable prettier/prettier */

import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { OPERATOR_SQL } from "src/filter/operator.map";


@Injectable()
export class LedureRepository {


    constructor(private readonly db: DatabaseService) {

    }

    async getTotalCount(userid: number): Promise<number> {
        try {
            const rows = await this.db.query<number>(
                `
              SELECT COUNT(*) as total
              FROM ledger_entries where company_id=${userid
                
              }
              `
            );
            return rows[0].total;

        }

        catch (error) {

            console.error("getTotalCount error is", error)
            throw error;
        }
    }

    async getFilteredCount(filters: any[], userid: number) {
        try {
            const where: string[] = ['le.company_id = ?'];
            const values: any[] = [userid];

            filters.forEach((f) => {
                let value = f.value;

                // EMPTY
                if (f.operator === 'isEmpty') {
                    where.push(`(${f.column} IS NULL OR ${f.column} = '')`);
                    return;
                }

                // NOT EMPTY
                if (f.operator === 'is_not_empty') {
                    where.push(`(${f.column} IS NOT NULL AND ${f.column} != '')`);
                    return;
                }

                // DATE
                if (f.type === 'date') {
                    const startOfDay = `${f.value} 00:00:00`;
                    const endOfDay = `${f.value} 23:59:59`;

                    if (f.operator === 'equals') {
                        where.push(`(${f.column} BETWEEN ? AND ?)`);
                        values.push(startOfDay, endOfDay);
                        return;
                    }

                    if (f.operator === 'before') {
                        where.push(`${f.column} < ?`);
                        values.push(startOfDay);
                        return;
                    }

                    if (f.operator === 'after') {
                        where.push(`${f.column} > ?`);
                        values.push(endOfDay);
                        return;
                    }

                    if (f.operator === 'between') {
                        const startDate = `${f.value} 00:00:00`;
                        const endDate = `${f.valueTo} 23:59:59`;

                        where.push(`(${f.column} BETWEEN ? AND ?)`);
                        values.push(startDate, endDate);
                        return;
                    }
                }

                // LIKE
                if (f.operator === 'contains') value = `%${value}%`;
                if (f.operator === 'starts_with') value = `${value}%`;
                if (f.operator === 'ends_with') value = `%${value}`;

                if (f.type === 'number') value = Number(value);

                where.push(`${f.column} ${OPERATOR_SQL[f.operator]} ?`);
                values.push(value);

            });

            const sql = `
                  SELECT COUNT(*) as total
                  FROM ledger_entries le
                   LEFT JOIN clients c1 ON le.client_id = c1.cl_id
                LEFT JOIN bank_account ac ON le.account_id = ac.id
                LEFT JOIN loans l ON le.loan_id=l.loan_id
                  ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                `;

            const result = await this.db.query(sql, values);
            return result[0]?.total ?? 0;
        }
        catch (error) {

            console.error("getFilteredCount is", error)
        }
    }

    async getLedgerByClientId(clientId: number, companyId: number) {
        try {
            const sql = `
              SELECT le.*,
                CONCAT(c1.first_name, ' ', c1.last_name) AS client_name,
                l.loan_document_number AS loan_no,
                ac.account_type AS account_name
              FROM ledger_entries le
              LEFT JOIN clients c1 ON le.client_id = c1.cl_id
              LEFT JOIN bank_account ac ON le.account_id = ac.id
              LEFT JOIN loans l ON le.loan_id = l.loan_id
              WHERE le.client_id = ?
                AND le.company_id = ?
              ORDER BY le.entry_id DESC
            `;

            const rows = await this.db.query(sql, [clientId, companyId]);
            return rows;
        } catch (error) {
            console.error('getLedgerByClientId error', error);
            throw error;
        }
    }


    async findWithFilters(filters: any[], page: number, limit: number, userid: number) {

        try {
            const where: string[] = ['le.company_id = ?'];
            const values: any[] = [userid];

            filters.forEach((f) => {
                let value = f.value;

                if (f.operator === 'isEmpty') {
                    where.push(`(${f.column} IS NULL OR ${f.column} = '')`);
                    return;
                }

                if (f.operator === 'is_not_empty') {
                    where.push(`(${f.column} IS NOT NULL AND ${f.column} != '')`);
                    return;
                }

                if (f.type === 'date') {
                    const startOfDay = `${f.value} 00:00:00`;
                    const endOfDay = `${f.value} 23:59:59`;

                    if (f.operator === 'equals') {
                        where.push(`(${f.column} BETWEEN ? AND ?)`);
                        values.push(startOfDay, endOfDay);
                        return;
                    }

                    if (f.operator === 'before') {
                        where.push(`${f.column} < ?`);
                        values.push(startOfDay);
                        return;
                    }

                    if (f.operator === 'after') {
                        where.push(`${f.column} > ?`);
                        values.push(endOfDay);
                        return;
                    }

                    if (f.operator === 'between') {
                        console.log("modified date start value", f.value)
                        console.log("modified date end value", f.valueTo)

                        const startDate = `${f.value} 00:00:00`;
                        const endDate = `${f.valueTo} 23:59:59`;

                        where.push(`(${f.column} BETWEEN ? AND ?)`);
                        values.push(startDate, endDate);
                        return;
                    }
                }

                if (f.operator === 'contains') value = `%${value}%`;
                if (f.operator === 'starts_with') value = `${value}%`;
                if (f.operator === 'ends_with') value = `%${value}`;
                if (f.type === 'number') value = Number(value);

                where.push(`${f.column} ${OPERATOR_SQL[f.operator]} ?`);
                values.push(value);
            });

            const safeLimit = Math.max(1, Number(limit));
            const safeOffset = Math.max(0, Number((page - 1) * limit));

            const sql = `
                 SELECT le.*,
                CONCAT(c1.first_name, ' ', c1.last_name) AS client_name,
                l.loan_document_number as loan_no,
                ac.account_type as account_name
                FROM ledger_entries le
                LEFT JOIN clients c1 ON le.client_id = c1.cl_id
                LEFT JOIN bank_account ac ON le.account_id = ac.id
                LEFT JOIN loans l ON le.loan_id=l.loan_id
                    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                    ORDER BY le.entry_id DESC
                    LIMIT ${safeLimit} OFFSET ${safeOffset}
                  `;

            const rows = await this.db.query(sql, values);
            return rows;
        }
        catch (error) {

            console.error("FindWithFilters error is", error)
        }
    }


    async findAll(page: number, limit: number, userid: number) {

        try {
            const safeLimit = Number(limit);
            const safeOffset = Number((page - 1) * limit);

            if (isNaN(safeLimit) || isNaN(safeOffset)) {
                throw new Error('Invalid pagination parameters');
            }

            const sql = `
                  SELECT le.*,
                CONCAT(c1.first_name, ' ', c1.last_name) AS client_name,
                l.loan_document_number as loan_no,
                ac.account_type as account_name
                  FROM ledger_entries le
                LEFT JOIN clients c1 ON le.client_id = c1.cl_id
                LEFT JOIN bank_account ac ON le.account_id = ac.id
                LEFT JOIN loans l ON le.loan_id=l.loan_id
                                WHERE le.company_id = ${userid}

                GROUP BY le.entry_id
                ORDER BY le.entry_id DESC
                LIMIT ${safeLimit} OFFSET ${safeOffset}
                `;

            const rows = await this.db.query(sql);
            return rows;
        }
        catch (error) {

            console.error("findAll is", error)
            throw error
        }
    }
}
