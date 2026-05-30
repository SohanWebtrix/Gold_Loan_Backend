/* eslint-disable prettier/prettier */


import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { ResultSetHeader } from "mysql2";
import { DatabaseService } from "src/database/database.service";
import { OPERATOR_SQL } from "src/filter/operator.map";
import * as Sentry from '@sentry/node';


@Injectable()
export class TransactionRepository {

    constructor(private readonly db: DatabaseService) {

    }


    async insertTransactionPayment(
        loanId: number,
        companyid: number,
        transactionid: number,
        payments: any[],
        conn: any
    ) {

        try {

            const values = payments.map(
                item => [
                    loanId,
                    companyid,
                    transactionid,
                    item.account_id,
                    item.payment_type,
                    item.amount,
                    item.transaction_reference_no || null,
                    item.transaction_date || null,
                    item.note || null,
                    item.payment_proof_file || null
                ]
            );

            await conn.query(
                `
    INSERT INTO transaction_payment (
      loan_id,
      company_id,
      transaction_id,
      account_id,
      payment_type,
      amount,
      transaction_reference_no,
      transaction_date,
      note,
      payment_proof_file
    )
    VALUES ?
    `,
                [values]
            );
        }
        catch (error) {

            console.error("insert loan disbursement bulk error is", error);

        }
    }


    async updateBankBalance(accountid: number, account_balance: number, conn) {

        try {

            const db = conn ?? this.db;

            return await db.query(
                `
        UPDATE bank_account
        SET
        remaining_balance = ?
        WHERE id = ?
        `,

                [
                    account_balance,
                    accountid
                ]
            );

        }

        catch (error) {
            Sentry.captureException(error);
        }


    }


    async getLatestInterestBalance(
        loanId: number,
        conn: any
    ) {

        const [rows]: any = await conn.query(
            `
      SELECT balance_after
      FROM ledger_entries
      WHERE loan_id = ?
      AND type = 'interest'
      ORDER BY entry_id DESC
      LIMIT 1
      `,
            [loanId]
        );

        if (rows.length > 0) {
            return Number(rows[0].balance_after);
        }

        return 0;
    }

    async recalculatePrincipalPaymentInterest(
        loanId: number,
        paymentDate: string,
        principalPaid: number,
        interestRate: number,
        conn?: any,
    ) {

        const db = conn ?? this.db;

        const [rows] = await db.query(
            `
    SELECT
      id,
      daily_interest,
      accrued_interest
    FROM loan_daily_interest
    WHERE loan_id = ?
    AND interest_date > ?
    ORDER BY interest_date ASC
    `,
            [loanId, paymentDate]
        );

        // get accrued interest ON payment date
        const [previousRow] = await db.query(
            `
    SELECT accrued_interest
    FROM loan_daily_interest
    WHERE loan_id = ?
    AND interest_date = ?
    LIMIT 1
    `,
            [loanId, paymentDate]
        );

      

        let runningAccrued =
            Number(previousRow?.[0]?.accrued_interest || 0);

        for (const row of rows) {

            // interest reduction because principal reduced
            const reducedDailyInterest =
                (Number(principalPaid) * Number(interestRate))
                / 100 / 365;

            // new corrected daily interest
            const correctedDailyInterest =
                Math.max(
                    Number(row.daily_interest) - reducedDailyInterest,
                    0
                );

            runningAccrued += correctedDailyInterest;

            await db.query(
                `
      UPDATE loan_daily_interest
      SET
        daily_interest = ?,
        accrued_interest = ?
      WHERE id = ?
      `,
                [
                    correctedDailyInterest,
                    runningAccrued,
                    row.id
                ]
            );
        }
    }


    async searchTransactions(
        search: string,
        page: number,
        limit: number,
        companyId: number,
    ) {

        const safeLimit = Math.max(1, Number(limit));
        const safeOffset = Math.max(0, (page - 1) * limit);

        const searchValue = `%${search}%`;

        const sql = `
    SELECT
      ts.*,

      CONCAT(
        c.first_name,
        ' ',
        c.last_name
      ) as client_name

    FROM loan_transactions ts

    LEFT JOIN clients c
      ON ts.client_id = c.cl_id

    LEFT JOIN loans lo
      ON ts.loan_id  = lo.loan_id

    WHERE ts.company_id = ?

    AND (
      ts.receipt_no LIKE ?

      OR lo.loan_document_number LIKE?

      OR c.mobile_no LIKE ?

      OR c.first_name LIKE ?

      OR c.last_name LIKE ?

      OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?
    )

    ORDER BY ts.transaction_id DESC

    LIMIT ? OFFSET ?
  `;

        const values = [
            companyId,

            searchValue,
            searchValue,
            searchValue,
            searchValue,
            searchValue,

            safeLimit,
            safeOffset,
        ];

        const rows = await this.db.query(sql, values);

        // COUNT QUERY

        const countSql = `
    SELECT COUNT(*) as total

    FROM loans lo

    LEFT JOIN clients c
      ON lo.client_id = c.cl_id

    WHERE lo.compl_id = ?

    AND (
      lo.loan_document_number LIKE ?

      OR c.mobile_no LIKE ?

      OR c.first_name LIKE ?

      OR c.last_name LIKE ?

      OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?
    )
  `;

        const countResult = await this.db.query(
            countSql,
            [
                companyId,

                searchValue,
                searchValue,
                searchValue,
                searchValue,
                searchValue,
            ]
        );

        const totalRecords = countResult[0]?.total || 0;
        const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
        const end = Math.min(page * limit, totalRecords);

        return {
            currentPage: page,
            limit,
            start,
            end,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            data: rows,
        };
    }

    async getLatestDailyInterest(
        loanId: number,
        conn?: any,
    ) {
        try {
            const db = conn ?? this.db;

            const [rows] = await db.query(
                `
    SELECT accrued_interest
    FROM loan_daily_interest
    WHERE loan_id = ?
    ORDER BY interest_date DESC
    LIMIT 1
    `,
                [loanId]
            );

            return Number(
                rows?.[0]?.accrued_interest || 0
            );
        }
        catch (error) {
            Sentry.captureException(error);
            console.error("error is", error);
        }
    }



    async getInterestAsOfDate(
        loanId: number,
        transactionDate: string,
        conn?: any,
    ) {
        try {
            const db = conn ?? this.db;

            const rows = await db.query(
                `
    SELECT accrued_interest
    FROM loan_daily_interest
    WHERE loan_id = ?
    AND interest_date = ?
    LIMIT 1
    `,
                [
                    loanId,
                    transactionDate,
                ]
            );

            return rows[0];
        }
        catch (error) {
            Sentry.captureException(error);

        }
    }

    async adjustFutureDailyInterest(
        loanId: number,
        transactionDate: string,
        interestPaid: number,
        conn?: any,
    ) {
        try {

            const db = conn ?? this.db;

            return db.query(
                `
    UPDATE loan_daily_interest
    SET accrued_interest =
      GREATEST(accrued_interest - ?, 0)

    WHERE loan_id = ?
AND interest_date BETWEEN ? AND CURDATE()`,
                [
                    interestPaid,
                    loanId,
                    transactionDate,
                ]
            );
        }
        catch (error) {
            Sentry.captureException(error);

        }
    }


    async updateTodayDailyInterest(
        loanId: number,
        accruedInterest: number,
        conn?: any,
    ) {

        try {
            const db = conn ?? this.db;

            return db.query(
                `
    UPDATE loan_daily_interest
    SET accrued_interest = ?
    WHERE loan_id = ?
    AND interest_date = CURDATE()
    `,
                [
                    accruedInterest,
                    loanId,
                ]
            );
        }
        catch (error) {
            Sentry.captureException(error);

        }
    }

    async updateLoanRunningBalance(
        loanId: number,
        data: any,
        conn?: any,
    ) {

        try {
            const db = conn ?? this.db;

            return db.query(
                `
    UPDATE loans
    SET
      principal_balance = ?,
      accrued_interest = ?,
      total_amount = ?
    WHERE loan_id = ?
    `,
                [
                    data.principal_balance,
                    data.accrued_interest,
                    data.total_amount,
                    loanId,
                ]
            );
        }
        catch (error) {
            Sentry.captureException(error);

        }

    }

    async getLatestAccountBalance(accountId: number, conn: any) {

        try {
            const [rows]: any = await conn.query(
                `
        SELECT balance_after
        FROM ledger_entries
        WHERE account_id = ?
        AND type = 'account'
        ORDER BY entry_id DESC
        LIMIT 1
        `,
                [accountId]
            );

            if (rows.length > 0) {
                return Number(rows[0].balance_after);
            }

            const [account]: any = await conn.query(
                `
        SELECT opening_balance
        FROM bank_account
        WHERE id = ?
        `,
                [accountId]
            );

            return Number(account[0].opening_balance);
        }
        catch (error) {
            Sentry.captureException(error);

        }

    }


    async getLatestLoanBalance(loanId: any, conn: any) {

        try {
            const [rows]: any = await conn.query(
                `
        SELECT balance_after
        FROM ledger_entries
        WHERE loan_id = ?
        AND type = 'loan'
        ORDER BY entry_id DESC
        LIMIT 1
        `,
                [loanId]
            );

            if (rows.length > 0) {
                return Number(rows[0].balance_after);
            }

            return 0;
        }
        catch (error) {
            Sentry.captureException(error);

        }
    }


    async insertLedger(
        data: any,
        conn: any,
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

    async getTransactionPayments(transactionId: number) {
        try {

            const TransactionRows: any[] = await this.db.query(
                `
     SELECT * from transaction_payment where transaction_id=?
      `,
                [transactionId]
            );

            if (!TransactionRows.length) {
                return {
                    success: false,
                    message: 'transaction payment not found',
                };
            }


            return TransactionRows;

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
                throw new NotFoundException("Prefix not set for transaction");
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
               LEFT JOIN transaction_payment tp
        ON tp.transaction_id = tr.transaction_id
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
            l.loan_document_number  AS loan_document_number,
            GROUP_CONCAT(
          DISTINCT tp.payment_type
          ORDER BY tp.payment_type
          SEPARATOR ','
        ) AS payment_types
            FROM loan_transactions tr
            LEFT JOIN clients c1 ON tr.client_id = c1.cl_id
            LEFT JOIN loans l ON tr.loan_id = l.loan_id
               LEFT JOIN transaction_payment tp
        ON tp.transaction_id = tr.transaction_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        GROUP BY tr.transaction_id
            ORDER BY tr.transaction_id DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
          `;

      

            const rows = await this.db.query(sql, values);

            return rows.map((row) => ({
                ...row,
                payment_types: row.payment_types
                    ? row.payment_types.split(",")
                    : []
            }));

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
            l.loan_document_number  AS loan_document_number,
                 GROUP_CONCAT(
          DISTINCT tp.payment_type
          ORDER BY tp.payment_type
          SEPARATOR ','
        ) AS payment_types

          FROM loan_transactions tr
          LEFT JOIN clients c1 ON tr.client_id = c1.cl_id
          LEFT JOIN loans l ON tr.loan_id = l.loan_id
              LEFT JOIN transaction_payment tp
        ON tp.transaction_id = tr.transaction_id
            WHERE tr.company_id = ${userid}
              GROUP BY tr.transaction_id

          ORDER BY tr.transaction_id  DESC
          LIMIT ${safeLimit} OFFSET ${safeOffset}
        `;

            const rows = await this.db.query(sql);
            return rows.map((row) => ({
                ...row,
                payment_types: row.payment_types
                    ? row.payment_types.split(",")
                    : []
            }));

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
             SELECT client_id,principal_amount,principal_balance,accrued_interest,interest_amount,total_amount, overdue_amount,loan_status,due_date,duration_unit,interest_rate,total_topup_amount from loans WHERE loan_id = ? LIMIT 1
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

            delete payload.payments;

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

        try {
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
        catch (error) {
            Sentry.captureException(error);

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
                client_code,
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

    async getClientLoans(clientId: number, companyId: number, transactionDate?: string) {

        try {
            const rows = await this.db.query(
                `
SELECT
    l.loan_id,
    l.loan_start_date,
    l.interest_rate,
    l.due_date as loan_end_date,
    COALESCE(lt.principal_balance,l.principal_amount,l.principal_amount) AS principal_amount,
     -- INTEREST AS OF SELECTED DATE
    COALESCE(
        di.accrued_interest,
        l.accrued_interest,
        0
    ) AS interest_amount,


    l.loan_status,
    l.loan_document_number,
lt.transaction_date AS last_transaction_date,
lt.topup_date as topup_date,
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
        WHERE company_id = ?
        AND client_id = ?
        GROUP BY loan_id
    ) t2
    ON t1.loan_id = t2.loan_id
    AND t1.transaction_id = t2.max_id
) lt
ON l.loan_id = lt.loan_id

LEFT JOIN (
    SELECT d1.loan_id,
           d1.accrued_interest

    FROM loan_daily_interest d1

    INNER JOIN (
        SELECT
            loan_id,
            MAX(interest_date) AS max_date

        FROM loan_daily_interest

        WHERE interest_date <= ?

        GROUP BY loan_id
    ) d2
      ON d1.loan_id = d2.loan_id
     AND d1.interest_date = d2.max_date
) di
ON l.loan_id = di.loan_id


LEFT JOIN mortgaged_items m
ON l.loan_id = m.loan_id

WHERE l.client_id = ?
AND l.compl_id = ?
AND l.loan_status IN ('active', 'overdue')

ORDER BY l.loan_id DESC
            `,
                [
                    companyId,
                    clientId,
                    transactionDate || new Date(),

                    clientId,
                    companyId
                ]
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
  l.loan_start_date,
    l.accrued_interest,
  l.total_amount,
  l.interest_rate,
  l.loan_status,
  l.total_topup_amount,
    topup.client_total_topup_amount,
  CONCAT(
             TIMESTAMPDIFF(MONTH, l.loan_start_date, l.due_date), ' months ',
             DATEDIFF(
                 l.due_date,
                DATE_ADD(l.loan_start_date, INTERVAL TIMESTAMPDIFF(MONTH, l.loan_start_date, l.due_date) MONTH)
                ), ' days'
            ) AS tenure,
  COALESCE(SUM(CASE WHEN t.status = 'SUCCESS' THEN t.paid_amount ELSE 0 END), 0) AS total_paid_amount,
  COALESCE(SUM(CASE WHEN t.status = 'SUCCESS' THEN t.principal_paid ELSE 0 END), 0) AS total_paid_principal,
  COALESCE(SUM(CASE WHEN t.status = 'SUCCESS' THEN t.interest_paid ELSE 0 END), 0) AS total_paid_interest,
  MAX(CASE WHEN t.status = 'SUCCESS' THEN t.transaction_date ELSE NULL END) AS last_payment_date,
  lt.principal_balance AS current_principal_balance,
  lt.interest_balance AS current_interest_balance,
  lt.total_balance AS current_total_balance,
  c.client_code,
  c.caste,
  c.occupation,
  c.mobile_no,
  c.email,
  c.dob,
  c.gender,
  c.status,
  c.created_date,
  CONCAT(cust.first_name, ' ', cust.last_name) AS created_by,
  c.first_name,
  c.last_name,
  c.street_add1,
  c.street_add2
FROM clients c
LEFT JOIN customers cust ON c.created_by = cust.customer_id
LEFT JOIN loans l ON l.client_id = c.cl_id AND l.compl_id = ? AND l.loan_status IN ('active', 'overdue', 'close')
LEFT JOIN (
   SELECT
      client_id,
      compl_id,
      COALESCE(SUM(total_topup_amount),0) AS client_total_topup_amount
   FROM loans
   GROUP BY client_id, compl_id
) topup
  ON topup.client_id = c.cl_id
 AND topup.compl_id = ?
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
WHERE c.cl_id = ?
GROUP BY
  c.cl_id,
  c.client_code,
  c.caste,
  c.occupation,
  c.mobile_no,
  c.email,
  c.dob,
  c.gender,
  c.status,
  c.created_date,
  c.first_name,
  c.last_name,
  c.street_add1,
  c.street_add2,
  l.loan_id,
  l.loan_document_number,
  l.principal_amount,
  l.interest_amount,
  l.total_amount,
  l.interest_rate,
  lt.principal_balance,
  lt.interest_balance,
  lt.total_balance,
  l.loan_status,
l.total_topup_amount,
topup.client_total_topup_amount,
cust.first_name,
cust.last_name
ORDER BY l.loan_id DESC
                `,

                [companyId, companyId, companyId, clientId, companyId, clientId, clientId]
            );

            //             loans                    → The loan itself (what was given)
            //   + First LEFT JOIN      → All payments ever made (to calculate totals)
            //   + INNER JOIN inside    → Find which transaction is the most recent one
            //   + Second LEFT JOIN     → Grab balance from that most recent transaction

            return rows;
        }

        catch (error) {

            Sentry.captureException(error);

            console.error('getClientLoanSummary error', error);
            throw error;

        }

    }

    async getTransactionReceipt(transactionId: number, companyId: number) {

        try {

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
  t.receipt_no,
  t.paid_amount,
  t.transaction_ref_no,
  t.topup_date,
  CONCAT_WS(' ', c.first_name, c.last_name) AS client_name,
  c.client_code,
  c.caste,
 c.client_code,
  c.mobile_no,
  CONCAT_WS(' ', cust.first_name, cust.last_name) AS created_by_name,
  YEAR(t.transaction_date) AS financial_year,
  l.loan_id,
  l.loan_document_number,
  l.principal_amount,
  l.loan_status,
  l.loan_start_date,
  l.due_date,
  l.accrued_interest,
  l.total_amount,
  m.gold_item_id,
  m.category,
  m.morgaged_note,
  m.gross_weight,
  m.net_weight,
  m.total_weight,

  cm.company_name,
  cm.company_email,
  cm.company_mobile,
    cm.license_number,
  cm.note,
  cm.company_logo,
  cm.address,

  tp.payment_type

FROM loan_transactions t
JOIN clients c ON t.client_id = c.cl_id
JOIN loans l ON t.loan_id = l.loan_id
LEFT JOIN mortgaged_items m ON l.loan_id = m.loan_id
LEFT JOIN company cm ON t.company_id = cm.company_id
LEFT JOIN customers cust ON t.created_by = cust.customer_id
LEFT JOIN transaction_payment tp
  ON tp.transaction_id = t.transaction_id

WHERE t.transaction_id = ?
AND t.company_id = ?
`,
                [transactionId, companyId]
            );

            return rows;
        }

        catch (error) {
            Sentry.captureException(error);

            console.error('getTransactionReceipt error', error);
            throw error;
        }
    }


    async getAccountBalances(
        accountIds: number[],
        conn: any
    ) {

        if (!accountIds.length) {
            return [];
        }

        const placeholders =
            accountIds.map(() => '?').join(',');

        const [rows]: any =
            await conn.query(
                `
      SELECT
        ba.id AS account_id,
        COALESCE(
          le.balance_after,
          ba.opening_balance
        ) AS balance
      FROM bank_account ba

      LEFT JOIN (
        SELECT l1.account_id,
               l1.balance_after
        FROM ledger_entries l1
        INNER JOIN (
          SELECT
            account_id,
            MAX(entry_id) AS max_entry_id
          FROM ledger_entries
          WHERE type = 'account'
          AND account_id IN (${placeholders})
          GROUP BY account_id
        ) latest
          ON l1.entry_id =
             latest.max_entry_id
      ) le
        ON le.account_id = ba.id

      WHERE ba.id IN (${placeholders})
      `,
                [...accountIds, ...accountIds]
            );

        return rows;

    }

}