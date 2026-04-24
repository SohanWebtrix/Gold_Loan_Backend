import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { OPERATOR_SQL } from "src/filter/operator.map";

/* eslint-disable prettier/prettier */
@Injectable()
export class TransactionRepository {

    constructor(private readonly db: DatabaseService) {

    }

    async getLoanDetails(loanId: number) {
        try {

            const loanRows: any[] = await this.db.query(
                `
     SELECT 
    l.principal_amount,l.interest_rate,l.interest_amount,l.overdue_amount,l.loan_start_date,l.due_date,
     c.cl_id as client_id,
      CONCAT(c.first_name, ' ', c.last_name) as client_name,
      c.aadhaar_card_no,
      c.pan_card_no
    FROM loans l
    JOIN clients c ON c.cl_id = l.client_id
WHERE l.loan_id = ?
LIMIT 1
      `,
                [loanId]
            );

            if (!loanRows.length) {
                return {
                    success: false,
                    message: 'Loan not found',
                };
            }

            const loan = loanRows[0];

            return loan;

        } catch (error) {

            console.error(
                '❌ getLoanFullDetails error:',
                error
            );

            throw new InternalServerErrorException(
                'Failed to fetch loan details'
            );
        }
    }


    async getTotalCount(userid: number): Promise<number> {
        try {
            const rows = await this.db.query<number>(
                `
        SELECT COUNT(*) as total
        FROM loan_transactions where company_id=${userid}
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
            const where: string[] = ['tr.company_id =?'];
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
          FROM loan_transactions tr
          LEFT JOIN loans l ON tr.loan_id = l.loan_id
          LEFT JOIN clients c1 ON tr.client_id = c1.cl_id
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        `;

            const result = await this.db.query(sql, values);
            return result[0]?.total ?? 0;
        }
        catch (error) {

            console.error("getFilteredCount is", error)
        }
    }


    async findWithFilters(filters: any[], page: number, limit: number, userid: number) {
        try {
            const where: string[] = ['tr.company_id =?'];
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
            SELECT tr.*,
            CONCAT(c1.first_name, ' ', c1.last_name) as client_name,
            l.loan_document_number  AS loan_document_number

            FROM loan_transactions tr
            LEFT JOIN clients c1 ON tr.client_id = c1.cl_id
            LEFT JOIN loans l ON tr.loan_id = l.loan_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY tr.transaction_id DESC
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
          SELECT tr.*,
          CONCAT(c1.first_name, ' ', c1.last_name) as client_name,
            l.loan_document_number  AS loan_document_number
          FROM loan_transactions tr
          LEFT JOIN clients c1 ON tr.client_id = c1.cl_id
          LEFT JOIN loans l ON tr.loan_id = l.loan_id
            WHERE tr.company_id = ${userid}
          ORDER BY tr.transaction_id  DESC
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


    async getLoanById(loanId: number) {
        try {

            const loanRows = await this.db.query(
                `
             SELECT client_id,principal_amount,interest_amount,total_amount, overdue_amount,loan_status from loans WHERE loan_id = ? LIMIT 1
              `,
                [loanId]
            );

            if (!loanRows.length) {
                return {
                    success: false,
                    message: 'Loan not found',
                };
            }

            return loanRows[0];

        } catch (error) {

            console.error(
                '❌ getLoanFullDetails error:',
                error
            );

            throw new InternalServerErrorException(
                'Failed to fetch loan details'
            );
        }
    }



    async insertTransaction(
        data: any,
        conn: any,
    ) {
        try {

            const payload = {
                ...data
            };

            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    payload[key] = null;
                }
            });

            const columns =
                Object.keys(payload).join(', ');

            const placeholders =
                Object.keys(payload)
                    .map(() => '?')
                    .join(', ');

            const values =
                Object.values(payload);

            const [result] =
                await conn.query(
                    `
        INSERT INTO loan_transactions
        (${columns})
        VALUES (${placeholders})
        `,
                    values
                );

            return result;

        } catch (error) {

            console.error(
                'insertTransaction error',
                error
            );

            throw error;
        }
    }



    async updateLoanBalance(
        loanId: number,
        dto: any,
        conn: any,
    ) {
        try {

            const db = conn ?? this.db;

            // remove undefined fields
            const filteredData =
                Object.fromEntries(
                    Object.entries(dto).filter(
                        ([_, value]) =>
                            value !== undefined
                    )
                );

            const fields =
                Object.keys(filteredData);

            if (!fields.length) {
                return {
                    message:
                        'Nothing to update',
                };
            }

            const setClause =
                fields
                    .map(
                        key => `${key} = ?`
                    )
                    .join(', ');

            const values =
                Object.values(
                    filteredData
                );

            const sql = `
      UPDATE loans
      SET ${setClause}
      WHERE loan_id = ?
    `;

            await db.query(
                sql,
                [...values, loanId]
            );

            return {
                message:
                    'Loan balance updated',
            };

        } catch (error) {

            console.error(
                'updateLoanBalance error',
                error
            );

            throw error;
        }
    }

    async getSearchClient(search: string, companyid: number) {
        
        try {
            const rows: any = await this.db.query(
                `
            SELECT 
                cl_id,
                CONCAT(first_name, ' ', last_name) AS full_name
            FROM clients
            WHERE compc_id = ?
            AND (
                first_name LIKE ?
                OR last_name LIKE ?
                OR CONCAT(first_name, ' ', last_name) LIKE ?
                OR mobile_no LIKE ?
            )
            `,
                [
                    companyid,
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`,
                    `%${search}%`
                ]
            );

            return rows;
        } catch (error) {
            console.error('getClient search error', error);
            throw error;
        }
    }

    async getClientLoans(clientId: number, companyId: number) {

        try {
            const rows = await this.db.query(
                `
      SELECT
        l.loan_id,
        l.principal_amount,
        l.interest_amount,
        l.loan_status,

        m.gold_item_id ,
        m.category,
        m.morgaged_note

      FROM loans l

      LEFT JOIN mortgaged_items m
        ON l.loan_id = m.loan_id

      WHERE l.client_id = ?
      AND l.compl_id = ?

      ORDER BY l.loan_id DESC
      `,
                [clientId, companyId]
            );

            return rows;

        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async getTransactionReceipt(transactionId: number, companyId: number) {

        const rows = await this.db.query(
            `
SELECT
  t.transaction_id,
  t.transaction_type,
  t.transaction_date,
  t.principal_paid,
  t.interest_paid,
  t.principal_balance,
  t.interest_balance,
  t.total_balance,
  t.receipt_no,
  t.paid_amount,
  t.payment_method,
  t.transaction_ref_no,
  t.transaction_date,
  CONCAT_WS(' ', c.first_name, c.last_name) AS client_name,
  c.client_code,
  l.loan_id,
  l.loan_document_number,
  l.principal_amount,
  l.loan_status,
  l.loan_start_date,
  l.due_date,

  m.gold_item_id,
  m.category,
  m.morgaged_note,
  m.gross_weight,
  m.net_weight,
  m.total_weight,

  cm.company_name,
  cm.company_email,
  cm.company_mobile

FROM loan_transactions t
JOIN clients c ON t.client_id = c.cl_id
JOIN loans l ON t.loan_id = l.loan_id
LEFT JOIN mortgaged_items m ON l.loan_id = m.loan_id
LEFT JOIN company cm ON t.company_id = cm.company_id
WHERE t.transaction_id = ?
AND t.company_id = ?
`,
            [transactionId, companyId]
        );

        return rows;
    }

}

