import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ResultSetHeader } from "mysql2";
import { DatabaseService } from "src/database/database.service";
import { OPERATOR_SQL } from "src/filter/operator.map";
import * as Sentry from '@sentry/node';


/* eslint-disable prettier/prettier */
@Injectable()
export class TransactionRepository {

    constructor(private readonly db: DatabaseService) {

    }

     async insertLedger(
            data: any,
            conn:any,
        ) {
                    const db = conn ?? this.db;
    
            try {
    
                const payload: any = {
                    ...data,
                };
    
    
                Object.keys(payload).forEach(key => {
                    if (payload[key] === undefined) {
                        payload[key] = null;
                    }
                });
    
                const columns = Object.keys(payload).join(", ");
                const placeholders = Object.keys(payload).map(() => "?").join(", ");
                const values = Object.values(payload);
    
                const [result] = await db.query(
                    `INSERT INTO ledger_entries (${columns}) VALUES (${placeholders})`,
                    values
                );
    
                return result;
    
            } catch (error: any) {
    
                                        Sentry.captureException(error);
                
                console.error("❌ fail to insert ledure DB error:", error);
    
                throw new InternalServerErrorException(
                    "Failed to insert ledure"
                );
            }
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

                                    Sentry.captureException(error);
            
            console.error(
                '❌ getLoanFullDetails error:',
                error
            );

            throw new InternalServerErrorException(
                'Failed to fetch loan details'
            );
        }
    }

    async generateNumber(companyId: number, docType: string, conn?: any): Promise<string> {

        const db = conn ?? this.db;


        try {
            const [rows]: any = await db.query(
                `
      SELECT *
      FROM prefix_table
      WHERE company_id = ?
      AND doc_type = ?
      FOR UPDATE
      `,
                [companyId, docType]
            );

            if (rows.length === 0) {
                throw new Error("Sequence configuration not found");
            }

            const row = rows[0];

            const nextNo = row.last_no + 1;

            await db.query(
                `
      UPDATE prefix_table
      SET last_no = ?
      WHERE id = ?
      `,
                [nextNo, row.id]
            );

            return `${row.prefix}-${row.year}-${nextNo}`;

        }
        catch (error) {
                                    Sentry.captureException(error);
            
            console.error("db error is", error)
            throw error;
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
                                    Sentry.captureException(error);
            

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

                                    Sentry.captureException(error);
            
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

                                    Sentry.captureException(error);
            
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
                                    Sentry.captureException(error);
            
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

                                    Sentry.captureException(error);
            
            console.error(
                '❌ getLoanFullDetails error:',
                error
            );

            throw new InternalServerErrorException(
                'Failed to fetch loan details'
            );
        }
    }

    async updateTransactionFile(tid: number, files: any) {
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
             UPDATE loan_transactions
              SET ${fields.join(', ')}
              WHERE transaction_id  = ?
            `;

            values.push(tid);

            const result = await this.db.query<ResultSetHeader>(sql, values);

            return result;

        } catch (error) {
                                    Sentry.captureException(error);
            

            console.error("UpdateFilepath error", error);
            throw error;

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

                                    Sentry.captureException(error);
            

            console.error(
                'insertTransaction error',
                error
            );

            throw error;
        }
    }

    async getLastTransaction(loanId: number) {
        const rows = await this.db.query(
            `
      SELECT *
      FROM loan_transactions
      WHERE loan_id = ?
      ORDER BY transaction_id DESC
      LIMIT 1
      `,
            [loanId]
        );

        return rows.length ? rows[0] : null;
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
                                    Sentry.captureException(error);
            

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
            AND status = 'active'
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
                                    Sentry.captureException(error);
            
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

    COALESCE(lt.principal_balance, l.principal_amount) AS principal_amount,
    COALESCE(lt.interest_balance, l.interest_amount) AS interest_amount,

    l.loan_status,

    m.gold_item_id,
    m.category,
    m.morgaged_note

FROM loans l

LEFT JOIN (
    SELECT t1.*
    FROM loan_transactions t1
    INNER JOIN (
        SELECT loan_id, MAX(transaction_id) AS max_id
        FROM loan_transactions
        GROUP BY loan_id
    ) t2
    ON t1.loan_id = t2.loan_id
    AND t1.transaction_id = t2.max_id
) lt
ON l.loan_id = lt.loan_id

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
                                    Sentry.captureException(error);
            
            console.error(error);
            throw error;
        }
    }

    async getClientLoanSummary(clientId: number, companyId: number) {

        try {
            const rows = await this.db.query(
                `
SELECT
  l.loan_id,
  l.loan_document_number,
  l.principal_amount,
  l.interest_amount,
  l.total_amount,
  l.interest_rate,
  l.loan_status,
  COALESCE(SUM(CASE WHEN t.status = 'SUCCESS' THEN t.paid_amount ELSE 0 END), 0) AS total_paid_amount,
  COALESCE(SUM(CASE WHEN t.status = 'SUCCESS' THEN t.principal_paid ELSE 0 END), 0) AS total_paid_principal,
  COALESCE(SUM(CASE WHEN t.status = 'SUCCESS' THEN t.interest_paid ELSE 0 END), 0) AS total_paid_interest,
  MAX(CASE WHEN t.status = 'SUCCESS' THEN t.transaction_date ELSE NULL END) AS last_payment_date,
  lt.principal_balance AS current_principal_balance,
  lt.interest_balance AS current_interest_balance,
  lt.total_balance AS current_total_balance
FROM loans l
LEFT JOIN loan_transactions t
  ON l.loan_id = t.loan_id
  AND t.company_id = ?
  AND t.client_id = ?
LEFT JOIN (
  SELECT t2.loan_id,
         t2.principal_balance,
         t2.interest_balance,
         t2.total_balance
  FROM loan_transactions t2
  INNER JOIN (
     SELECT loan_id, MAX(transaction_id) AS max_tx
     FROM loan_transactions
     WHERE company_id = ?
     AND client_id = ?
     GROUP BY loan_id
  ) latest
  ON t2.loan_id = latest.loan_id
  AND t2.transaction_id = latest.max_tx
) lt ON l.loan_id = lt.loan_id
WHERE l.client_id = ?
  AND l.compl_id = ?
GROUP BY
  l.loan_id,
  l.loan_document_number,
  l.principal_amount,
  l.interest_amount,
  l.total_amount,
  l.interest_rate,
  lt.principal_balance,
  lt.interest_balance,
  lt.total_balance
ORDER BY l.loan_id DESC
                `,
                [companyId, clientId, companyId, clientId, clientId, companyId]
            );

//             loans                    → The loan itself (what was given)
//   + First LEFT JOIN      → All payments ever made (to calculate totals)
//   + INNER JOIN inside    → Find which transaction is the most recent one
//   + Second LEFT JOIN     → Grab balance from that most recent transaction

            return rows;
        } catch (error) {
                                    Sentry.captureException(error);
            
            console.error('getClientLoanSummary error', error);
            throw error;
        }
        
    }

    async getTransactionReceipt(transactionId: number, companyId: number) {

        try{

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

    catch(error)
    {
         Sentry.captureException(error);
            
            console.error('getTransactionReceipt error', error);
            throw error;
    }
}

}

