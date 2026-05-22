/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";
import { ResultSetHeader } from "mysql2";
import { DatabaseService } from "src/database/database.service";
import { CreateLoanDto } from "../createLoan.dto";
import * as Sentry from '@sentry/node';
import { OPERATOR_SQL } from "src/filter/operator.map";


@Injectable()

export class LoanRepository {

    constructor(private readonly db: DatabaseService) {

    }


    async insertLoanDisbursementsBulk(
        loanId: number,
        companyid: number,
        payments: any[],
        conn: any
    ) {

        try{

        const values = payments.map(
            item => [
                loanId,
                companyid,
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
    INSERT INTO loan_disbursements (
      loan_id,
      company_id,
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
    catch(error)
    {

        console.error("insert loan disbursement bulk error is",error);

    }
    }


    async updateBankBalance(accountid: number, account_balance: number, conn) {

        try {

            const db = conn ?? this.db;

            return db.query(
                `
    UPDATE bank_account
    SET
    bank_balance = ?
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

    async searchLoansmob(
        search: string,
        page: number,
        limit: number,
        companyId: number,
    ) {
        try {
            const safeLimit = Math.max(1, Number(limit));
            const safeOffset = Math.max(0, (page - 1) * limit);

            const searchValue = `%${search}%`;

            const sql = `
    SELECT
      lo.*,

      CONCAT(
        c.first_name,
        ' ',
        c.last_name
      ) as client_name,

      c.mobile_no

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

    ORDER BY lo.loan_id DESC

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

        catch (error) {
            Sentry.captureException(error);

        }
    }


    async insertDailyInterest(data: any, conn: any) {

        const db = conn ?? this.db;
        try {
            return db.query(
                `
    INSERT IGNORE INTO loan_daily_interest
    (
      loan_id,
      interest_date,
      daily_interest,
      accrued_interest
    )
    VALUES (?, ?, ?, ?)
    `,
                [
                    data.loan_id,
                    data.interest_date,
                    data.daily_interest,
                    data.accrued_interest,
                ]
            );
        }
        catch (error) {
            Sentry.captureException(error);

        }
    }

    async updateLoanInterest(
        loanId: number | null,
        data: any,
        conn: any,
    ) {

        try {
            const db = conn ?? this.db;

            return db.query(
                `
    UPDATE loans
    SET

      accrued_interest = ?,
      total_amount=?,
        last_interest_date = ?,
        loan_document_number=?
    WHERE loan_id = ?
    `,
                [
                    data.accrued_interest,
                    data.total_amount,
                    data.last_interest_date,
                    data.loan_document_number,
                    loanId,
                ]
            );

        }

        catch (error) {
            Sentry.captureException(error);

        }

    }

      async updateLoanInterestCorn(
        loanId: number | null,
        data: any,
        conn: any,
    ) {

        try {
            const db = conn ?? this.db;

            return db.query(
                `
    UPDATE loans
    SET

      accrued_interest = ?,
      total_amount=?,
        last_interest_date = ?
    WHERE loan_id = ?
    `,
                [
                    data.accrued_interest,
                    data.total_amount,
                    data.last_interest_date,
                    loanId,
                ]
            );

        }

        catch (error) {
            Sentry.captureException(error);

        }

    }


    async getActiveLoans() {

        try {
            return this.db.query(`
      SELECT
        loan_id,
        principal_balance,
        interest_rate,
        accrued_interest,
        last_interest_date
      FROM loans
      WHERE loan_status IN ('active', 'overdue')
    `);
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


    async generateNumber(companyId: number, docType: string): Promise<string> {


        try {
            const rows: any = await this.db.query(
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
                throw new NotFoundException("Prefix not set");
            }

            const row = rows[0];

            const nextNo = row.last_no + 1;

            await this.db.query(
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

            throw error;
        } finally {

        }
    }




    async getClientstatus(cid: number) {
        try {
            const rows = await this.db.query(
                'SELECT * FROM clients WHERE cl_id = ? LIMIT 1',
                [cid]
            );
            return rows[0];
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get Clinet By Id error", error)
        }
    }

    async getFilteredCountSearch(search: string, userid: number): Promise<number> {
        try {
            const rows = await this.db.query<number>(
                `SELECT COUNT(*) as total  FROM loans 
            WHERE compl_id = ?  AND (loan_id LIKE ? 
           OR loan_document_number LIKE ? OR adhar_card LIKE ?)`,
                [userid, `%${search}%`, `%${search}%`, `${search}`],
            );
            return rows[0].total;

        }

        catch (error) {
            Sentry.captureException(error);

            console.error("getTotalCount error is", error)
            throw error;
        }
    }


    async getSearchLons(page: number, limit: number, search: string, userid: number) {
        try {
            const rows: any = await this.db.query(
                `SELECT * FROM loans 
       WHERE compl_id = ?  AND (loan_id LIKE ? 
           OR loan_document_number LIKE ? OR adhar_card LIKE ?)`,
                [userid, `%${search}%`, `%${search}%`, `${search}`],
            );

            return rows;
        } catch (error) {
            Sentry.captureException(error);

            console.error('get Loan by Id ', error);
            throw error;
        }
    }


    private formatDateForDB(date: any): string | null {
        if (!date) return null;

        return (typeof date === 'string'
            ? DateTime.fromISO(date)
            : DateTime.fromJSDate(date)
        )
            .toUTC()
            .toFormat("yyyy-MM-dd HH:mm:ss");
    }




    async insertLoan(
        data: CreateLoanDto,
        userId: number
    ) {
        try {

            console.log("data in insertLoan is", data);

            const payload: any = {
                ...data,
                created_by: userId
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


            const result = await this.db.query<ResultSetHeader>(
                `INSERT INTO loans (${columns}) VALUES (${placeholders})`,
                values
            );

            return result;

        } catch (error: any) {

            Sentry.captureException(error);

            console.error("❌ insetLoan DB error:", error);


            throw new InternalServerErrorException(
                "Failed to create loan"
            );
        }
    }

    async insertLoanTransaction(
        data: any,
        userId: number,
        conn: any,
    ) {
        const db = conn ?? this.db;

        try {

            const payload: any = {
                ...data,
                created_by: userId
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
                `INSERT INTO loan_transactions (${columns}) VALUES (${placeholders})`,
                values
            );

            return result;

        } catch (error: any) {

            Sentry.captureException(error);

            console.error("❌ fail to insert transaction DB error:", error);


            throw new InternalServerErrorException(
                "Failed to create transaction"
            );
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

    // loan.repository.ts

    async insertNomineesBulk(
        loanId: number,
        nominees: any[],
        conn?: any,
    ) {

        const db = conn ?? this.db;

        try {
            if (!nominees?.length) return;

            const values = nominees.map((item) => [
                loanId,
                item.nominee_name,
                item.nominee_relation,
                item.nominee_address,
                item.nominee_phone,
            ]);

            const sql = `
      INSERT INTO nominees (
        loan_id,
        nominee_name,
        nominee_relation,
        nominee_address,
        nominee_phone
      )
      VALUES ?
    `;

            const [result] = await db.query(sql, [values]);

            return result;

        } catch (error: any) {

            Sentry.captureException(error);

            console.error(
                "❌ insertNomineesBulk DB error:",
                error,
            );

            throw new InternalServerErrorException(
                "Failed to insert nominees",
            );
        }
    }



    async insertMortgageItemsBulk(
        loanId: number,
        items: any[],
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {
            if (!items?.length) return;

            const values = items.map((item) => [
                loanId,
                item.category,
                item.purity_percentage,
                item.gross_weight,
                item.net_weight,
                item.rate,
                item.amount,
                item.gold_item,
                item.total_weight,
                item.morgaged_note,
                item.stone_weight,
                item.unit
            ]);

            const sql = `
      INSERT INTO mortgaged_items (
        loan_id,
        category,
        purity_percentage,
        gross_weight,
        net_weight,
        rate,
        amount,
        gold_item,
        total_weight,
        morgaged_note,
        stone_weight,
        unit
      )
      VALUES ?
    `;

            const [result] = await db.query(sql, [values]);

            return result;

        } catch (error: any) {

            Sentry.captureException(error);

            console.error(
                "❌ insertMortgageItemsBulk DB error:",
                error,
            );

            throw new InternalServerErrorException(
                "Failed to insert mortgaged items",
            );
        }
    }



    async updateFilesPath(lid: number, files: any) {

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
             UPDATE loans
              SET ${fields.join(', ')}
              WHERE loan_id = ?
            `;

            values.push(lid);

            const result = await this.db.query<ResultSetHeader>(sql, values);

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error("UpdateFilepath error", error);
            throw error;
        }
    }


    async deleteLoan(id: number) {
        console.log("inside delete loan repository")
        try {
            const rows = await this.db.query<ResultSetHeader>('delete from loans where loan_id=? limit 1', [id]);
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("failed to delete client", error);
        }
    }



    async getFilteredCount(filters: any[], userid: number) {
        try {
            const where: string[] = ['lo.compl_id = ?'];
            const values: any[] = [userid];

            filters.forEach((f) => {
                let value = f.value;

                const isClientNameFilter = f.column === "CONCAT(c1.first_name, ' ', c1.last_name)";

                if (isClientNameFilter) {
                    let value = f.value;
                    if (f.operator === 'contains') value = `%${value}%`;
                    if (f.operator === 'starts_with') value = `${value}%`;
                    if (f.operator === 'ends_with') value = `%${value}`;

                    if (f.operator === 'equals') {
                        where.push(
                            `(c1.first_name = ? OR c1.last_name = ? OR CONCAT(c1.first_name, ' ', c1.last_name) = ?)`
                        );
                        values.push(value, value, value);
                        return;
                    }

                    where.push(
                        `(c1.first_name ${OPERATOR_SQL[f.operator]} ? OR c1.last_name ${OPERATOR_SQL[f.operator]} ? OR CONCAT(c1.first_name, ' ', c1.last_name) ${OPERATOR_SQL[f.operator]} ?)`
                    );
                    values.push(value, value, value);
                    return;
                }
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
                        console.log("modified date start value", f.value)
                        console.log("modified date end value", f.valueTo)

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
      FROM loans lo
      LEFT JOIN customers a ON lo.created_by = a.customer_id
      LEFT JOIN customers a2 ON lo.modified_by = a2.customer_id
      LEFT JOIN clients c1 ON lo.client_id = c1.cl_id

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



    async getTotalCount(userid: number): Promise<number> {
        try {

            const rows: any = await this.db.query(
                `
  SELECT COUNT(*) as total
  FROM loans where compl_id=${userid}
  `
            ); return rows[0].total;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("getTotalCount error is", error)
            throw error;
        }
    }


    async findWithFilters(filters: any[], page: number, limit: number, userid: number) {
        try {
            const where: string[] = ['lo.compl_id = ?'];
            const values: any[] = [userid];

            filters.forEach((f) => {
                let value = f.value;


                const isClientNameFilter = f.column === "CONCAT(c1.first_name, ' ', c1.last_name)";

                if (isClientNameFilter) {
                    let value = f.value;
                    if (f.operator === 'contains') value = `%${value}%`;
                    if (f.operator === 'starts_with') value = `${value}%`;
                    if (f.operator === 'ends_with') value = `%${value}`;

                    if (f.operator === 'equals') {
                        where.push(
                            `(c1.first_name = ? OR c1.last_name = ? OR CONCAT(c1.first_name, ' ', c1.last_name) = ?)`
                        );
                        values.push(value, value, value);
                        return;
                    }

                    where.push(
                        `(c1.first_name ${OPERATOR_SQL[f.operator]} ? OR c1.last_name ${OPERATOR_SQL[f.operator]} ? OR CONCAT(c1.first_name, ' ', c1.last_name) ${OPERATOR_SQL[f.operator]} ?)`
                    );
                    values.push(value, value, value);
                    return;
                }


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
            SELECT lo.*,
   
        CONCAT(c1.first_name, ' ', c1.last_name) as client_name
      FROM loans lo

      LEFT JOIN clients c1 ON lo.client_id = c1.cl_id

        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY loan_id DESC
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
            SELECT
                lo.*,
                CONCAT(c1.first_name, ' ', c1.last_name) AS client_name,
                COALESCE(tp.total_paid_amount, 0) AS total_paid_amount,
                lo.total_amount AS total_pending_amount,
               CONCAT(
             TIMESTAMPDIFF(MONTH, lo.loan_start_date, lo.due_date), ' months ',
             DATEDIFF(
                 lo.due_date,
                DATE_ADD(lo.loan_start_date, INTERVAL TIMESTAMPDIFF(MONTH, lo.loan_start_date, lo.due_date) MONTH)
                ), ' days'
            ) AS tenure
            FROM loans lo
            LEFT JOIN clients c1 ON lo.client_id = c1.cl_id
            LEFT JOIN (
                SELECT
                    loan_id,
                    SUM(COALESCE(paid_amount, 0)) AS total_paid_amount
                FROM loan_transactions
                WHERE status = 'SUCCESS'
                GROUP BY loan_id
            ) tp ON tp.loan_id = lo.loan_id
            WHERE lo.compl_id = ${userid}
            ORDER BY lo.loan_id DESC
            LIMIT ${safeLimit} OFFSET ${safeOffset}
        `;

            const rows = await this.db.query(sql);
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);
            console.error("findAll is", error);
        }
    }



    async getLoanById(loanId: number) {
        try {
            const loanRows = await this.db.query(
                `
SELECT 
  l.*,
  CONCAT_WS(' ', c.first_name, c.last_name) AS borrower,
  c.caste,
  c.mobile_no,
  c.client_code,
  c.email,
  c.dob,
  c.gender,
  c.city,
  cm.company_name,
  cm.license_number,
  cm.note,
  cm.company_logo,
  cm.address,
  CONCAT_WS(' ', cust.first_name, cust.last_name) AS created_by_name,
    CONCAT(
  YEAR(l.loan_start_date),
  '-',
  LPAD(RIGHT(YEAR(l.loan_start_date) + 1, 2), 2, '0')
) AS financial_year,
  l.loan_document_number AS loan_no
FROM loans l
JOIN clients c ON l.client_id = c.cl_id
LEFT JOIN customers cust ON l.created_by = cust.customer_id
LEFT JOIN company cm ON  l.compl_id = cm.company_id
WHERE l.loan_id = ?
LIMIT 1
            `,
                [loanId]
            );

            if (!loanRows.length) {
                return null;
            }

            const loan = loanRows[0];

            // Fetch mortgaged items
            const mortgagedItems = await this.db.query(
                `
SELECT *
FROM mortgaged_items
WHERE loan_id = ?
            `,
                [loanId]
            );

            // Attach items to loan object
            loan.mortgaged_items = mortgagedItems;

            return loan;

        } catch (error) {
            Sentry.captureException(error);

            console.error("get loan by id error is", error);
            throw error;
        }
    }

    async getNomineesByLoanId(loanId: number, conn?: any,
    ) {
        const db = conn ?? this.db;

        try {
            const [rows] = await db.query(
                'SELECT * FROM nominees WHERE loan_id = ?',
                [loanId]
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get nominee by id erros is", error)
            throw error;
        }
    }

    async getMortgageItemsByLoanId(loanId: number, conn?: any) {
        const db = conn ?? this.db;

        try {
            const [rows] = await db.query(
                'SELECT * FROM mortgaged_items WHERE loan_id = ?',
                [loanId]
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get mortgaged by id erros is", error)
            throw error;
        }
    }


    async getPaymentInfoByLoanId(loanId: number, conn?: any) {
        const db = conn ?? this.db;

        try {
            const [rows] = await db.query(
                'SELECT * FROM loan_disbursements WHERE loan_id = ?',
                [loanId]
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get payment info by id erros is", error)
            throw error;
        }
    }

    async deletePaymentInfo(id: number, conn?: any) {

        const db = conn ?? this.db;

        try {
            const [rows] = await db.query(
                'delete from loan_disbursements where id=?',
                [id]
            );

            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("delete payment info by id erros is", error)
            throw error;
        }
    }


    async getMortgage(loanId: number) {

        try {

            const rows = await this.db.query(
                `
SELECT
  m.*,
  (
  SELECT COALESCE(SUM(amount), 0)
  FROM mortgaged_items
  WHERE loan_id = m.loan_id
) AS total_mortgaged_amount,
  CONCAT_WS(' ', c.first_name, c.last_name) AS borrower,
  c.caste,
  c.client_code,
  c.mobile_no,
  c.street_add1,
  c.city,
  c.profile_pic_path,
  cm.company_name,
  cm.license_number,
  cm.note,
  cm.company_logo,
  cm.note,
  cm.address,
  CONCAT_WS(' ', cust.first_name, cust.last_name) AS created_by_name,
  CONCAT(
  YEAR(l.loan_start_date),
  '-',
  LPAD(RIGHT(YEAR(l.loan_start_date) + 1, 2), 2, '0')
) AS financial_year,
  l.loan_document_number  as loan_no,
  l.interest_rate,
  l.principal_amount,
  l.due_date,
  l.loan_start_date,
  l.transaction_date,
  l.interest_rate
FROM mortgaged_items m
JOIN loans l ON m.loan_id = l.loan_id
JOIN clients c ON l.client_id = c.cl_id
LEFT JOIN customers cust ON l.created_by = cust.customer_id
LEFT JOIN company cm ON l.compl_id  = cm.company_id
WHERE m.loan_id = ?
                `,
                [loanId]
            );


            return rows;

        }

        catch (error) {

            Sentry.captureException(error);

            console.error("get mortgaged by id erros is", error)
            throw error;
        }


    }


    async deletePaymentInfoBulk(
        ids: number[],
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {
            if (!ids || ids.length === 0) {
                return {
                    affectedRows: 0,
                };
            }

            // creates ?,?,? dynamically
            const placeholders = ids
                .map(() => '?')
                .join(',');

            const sql = `
        DELETE FROM loan_disbursements
        WHERE id IN (${placeholders})
      `;

            const [result] = await db.query(
                sql,
                ids,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ delete loan disbursement error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to delete loan disbursements',
            );
        }
    }


    async deleteMortgageItemsBulk(
        ids: number[],
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {
            if (!ids || ids.length === 0) {
                return {
                    affectedRows: 0,
                };
            }

            // creates ?,?,? dynamically
            const placeholders = ids
                .map(() => '?')
                .join(',');

            const sql = `
        DELETE FROM mortgaged_items
        WHERE gold_item_id IN (${placeholders})
      `;

            const [result] = await db.query(
                sql,
                ids,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ deleteMortgageItemsBulk error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to delete mortgage items',
            );
        }
    }

    async deleteNomineesBulk(
        ids: number[],
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {
            if (!ids || ids.length === 0) {
                return {
                    affectedRows: 0,
                };
            }

            // creates ?,?,? dynamically
            const placeholders = ids
                .map(() => '?')
                .join(',');

            const sql = `
        DELETE FROM nominees
        WHERE nominee_id IN (${placeholders})
      `;

            const [result] = await db.query(
                sql,
                ids,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ delete nominee error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to delete nominee',
            );
        }
    }


    async updateNominee(
        nomineeitemid: number,
        data: any,
        conn?: any,
    ) {
        const db = conn ?? this.db;

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
        UPDATE nominees
        SET ${fields.join(', ')}
        WHERE nominee_id = ?
      `;

            values.push(nomineeitemid);

            const [result] = await db.query(
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


    async insertNominee(
        loanId: number,
        data: any,
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {

            // clone incoming item
            const payload: any = {
                ...data,
                loan_id: loanId,
            };

            delete payload.nominee_id;


            // convert undefined => null
            Object.keys(payload).forEach((key) => {
                if (payload[key] === undefined) {
                    payload[key] = null;
                }
            });

            const columns = Object.keys(payload).join(', ');
            const placeholders = Object.keys(payload)
                .map(() => '?')
                .join(', ');

            const values = Object.values(payload);

            const [result] = await db.query(
                `
        INSERT INTO nominees
        (${columns})
        VALUES (${placeholders})
        `,
                values,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ insert Nomineee error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to insert nominee',
            );
        }
    }


    async updatePaymentInfo(
        payid: number,
        data: any,
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {

            // clone object
            const payload = { ...data };

            // remove fields not needed in SQL
            delete payload.id;
            delete payload.proof_file_index;
                        delete payload.remove_payment_proof;


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
        UPDATE loan_disbursements
        SET ${fields.join(', ')}
        WHERE id = ?
      `;

            values.push(payid);


            const [result] = await db.query(
                sql,
                values,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ update payment info error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to update payment info',
            );
        }
    }

    async insertPaymentInfo(
        loanId: number,
        companyId: number,
        data: any,
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {

            // clone incoming item
            const payload: any = {
                ...data,
                loan_id: loanId,
                company_id: companyId,
            };

            delete payload.proof_file_index;
                        delete payload.remove_payment_proof;



            // convert undefined => null
            Object.keys(payload).forEach((key) => {
                if (payload[key] === undefined) {
                    payload[key] = null;
                }
            });

            const columns = Object.keys(payload).join(', ');
            const placeholders = Object.keys(payload)
                .map(() => '?')
                .join(', ');

            const values = Object.values(payload);

            const [result] = await db.query(
                `
        INSERT INTO loan_disbursements
        (${columns})
        VALUES (${placeholders})
        `,
                values,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ insertMortgageItem error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to insert mortgage item',
            );
        }
    }


    async insertMortgageItem(
        loanId: number,
        data: any,
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {

            // clone incoming item
            const payload: any = {
                ...data,
                loan_id: loanId,
            };

            delete payload.gold_item_id;
            delete payload.file_index;
            delete payload.remove_gold_item;


            // convert undefined => null
            Object.keys(payload).forEach((key) => {
                if (payload[key] === undefined) {
                    payload[key] = null;
                }
            });

            const columns = Object.keys(payload).join(', ');
            const placeholders = Object.keys(payload)
                .map(() => '?')
                .join(', ');

            const values = Object.values(payload);

            const [result] = await db.query(
                `
        INSERT INTO mortgaged_items
        (${columns})
        VALUES (${placeholders})
        `,
                values,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ insertMortgageItem error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to insert mortgage item',
            );
        }
    }

    async updateMortgageItem(
        goldItemId: number,
        data: any,
        conn?: any,
    ) {
        const db = conn ?? this.db;

        try {

            // clone object
            const payload = { ...data };

            // remove fields not needed in SQL
            delete payload.gold_item_id;
            delete payload.remove_gold_item;
            delete payload.file_index;

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
        UPDATE mortgaged_items
        SET ${fields.join(', ')}
        WHERE gold_item_id = ?
      `;

            values.push(goldItemId);

            console.log("sql for updateMortgaged item is", sql);

            const [result] = await db.query(
                sql,
                values,
            );

            return result;

        } catch (error) {

            Sentry.captureException(error);

            console.error(
                '❌ updateMortgageItem error:',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to update mortgage item',
            );
        }
    }


    async updateLoan(
        loan_id: number,
        dto: any,
        filePaths: any,
        userid: number,
        conn
    ) {
        const db = conn ?? this.db;


        // merge dto + file paths
        try {

            const updateData = {
                ...dto,
                ...filePaths,
            };

            // ❗ remove flags (not DB columns)
            delete updateData.nominees;
            delete updateData.mortgaged_items;
            delete updateData.payments;



            // remove undefined
            const filteredData = Object.fromEntries(
                Object.entries(updateData).filter(([_, value]) => value !== undefined),
            );


            const { modified_date, ...restDto } = filteredData;

            console.log("filtered date in update monitoring is", restDto);

            const fields = Object.keys(restDto);

            if (!fields.length && !modified_date) {
                return { message: 'Nothing to update' };
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
        UPDATE loans
        SET ${setClause}
        WHERE loan_id = ?
      `;

            await db.query(sql, [...values, loan_id]);

            return { message: 'loan updated successfully' };

        }
        catch (error) {
            Sentry.captureException(error);

            console.error("updateLoan error is", error)


            throw new InternalServerErrorException(
                "Failed to modify loan"
            );
        }

    }


    async getLoanFullDetails(loanId: number) {
        try {

            const loanRows: any[] = await this.db.query(
                `
     SELECT 
    l.*,
    c.aadhaar_id_path as aadhaar_id_path,
    c.pan_card_path as pan_card_path,
     CONCAT(c.first_name, ' ', c.last_name) as client_name
FROM loans l
LEFT JOIN clients c
    ON l.client_id = c.cl_id
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


            const nominees = await this.db.query(
                `
      SELECT *
      FROM nominees
      WHERE loan_id = ?
      ORDER BY nominee_id ASC
      `,
                [loanId]
            );


            const mortgagedItems = await this.db.query(
                `
      SELECT *
      FROM mortgaged_items
      WHERE loan_id = ?
      ORDER BY gold_item_id ASC
      `,
                [loanId]
            );

            const paymentInfo =
                await this.db.query(
                    `
    SELECT 
      ld.*,
      bk.account_type AS account_name
    FROM loan_disbursements ld
    LEFT JOIN bank_account bk
      ON ld.account_id = bk.id
    WHERE ld.loan_id = ?
    ORDER BY ld.id ASC
    `,
    [loanId]
                );

            const transaction = await this.db.query(
                `
      SELECT *
      FROM loan_transactions
      WHERE loan_id = ?
      ORDER BY transaction_id ASC
      `,
                [loanId]
            );


            return {
                success: true,
                data: {
                    loan,
                    nominees,
                    mortgaged_items: mortgagedItems,
                    payments: paymentInfo,
                    transaction: transaction
                },
            };

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


    async getallloans(userid: number) {
        try {
            const rows = await this.db.query(
                `SELECT 
                loan_document_number ,
                loan_id 
             FROM loans 
             WHERE compl_id = ?`,
                [userid]
            );

            return rows;
        }
        catch (error) {
            Sentry.captureException(error);
            console.error("get all loans errors is", error);
            throw error;
        }
    }



    async getallbanks() {
        try {
            const rows = await this.db.query(
                `SELECT 
                id,account_type,bank_name
             FROM bank_account 
             `,
            );

            return rows;
        }
        catch (error) {
            Sentry.captureException(error);
            console.error("get all loans errors is", error);
            throw error;
        }
    }


}