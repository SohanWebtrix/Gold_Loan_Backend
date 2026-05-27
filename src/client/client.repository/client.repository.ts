/* eslint-disable prettier/prettier */

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { UpdateClientDto } from "../client.updatedto";
import { ResultSetHeader } from "mysql2";
import * as bcrypt from 'bcrypt';
import { CreateClientDto } from "../client.createdto";
import { DateTime } from 'luxon';
import { OPERATOR_SQL } from "src/filter/operator.map";
import * as Sentry from '@sentry/node';



@Injectable()
export class ClientRepository {
    constructor(private readonly db: DatabaseService) { }


    async getCompanyinterst(companyid: number) {
        try {
            const rows = await this.db.query(`select default_interest from company where company_id=?`, [companyid]);
            return rows[0]?.default_interest;
        } catch (error) {

            Sentry.captureException(error);
            console.error('getClient search error', error);

        }
    }


    async getSearchClients(search: string, companyid: number) {

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
            Sentry.captureException(error);

            console.error('getClient search error', error);
            throw error;
        }
    }


    async getSearchClient(page: number, limit: number, search: string, userid: number) {
        try {
            const rows: any = await this.db.query(
                `SELECT * FROM clients 
       WHERE cust_id = ?  AND (full_name LIKE ? 
       OR mobile_no LIKE ?)`,
                [userid, `%${search}%`, `%${search}%`],
            );

            return rows;
        } catch (error) {
            Sentry.captureException(error);

            console.error('getClient by name or mobile no error', error);
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



    async getUsersByid(userid: number) {
        try {
            const rows = await this.db.query(
                `SELECT cl.*,st.state_name AS state_name FROM clients cl LEFT JOIN ab_states st ON cl.state = st.state_id WHERE cl_id = ? LIMIT 1`,
                [userid]
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get user by id erros is", error)
            throw error;
        }
    }


    async getUsersByidLoans(userid: number) {
        try {
            const rows = await this.db.query(
                'SELECT aadhaar_card_no , pan_card_no , street_add1 ,aadhaar_id_path , pan_card_path FROM clients WHERE cl_id = ? LIMIT 1',
                [userid]
            );
            return rows[0];
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get client for loans by id error is ", error)
            throw error;
        }
    }

    async getallclients(userid: number) {
        try {
            const rows = await this.db.query(
                `SELECT 
                CONCAT(first_name, ' ', last_name) AS full_name,
                cl_id
             FROM clients 
             WHERE compc_id = ?`,
                [userid]
            );

            return rows;
        }
        catch (error) {
            Sentry.captureException(error);
            console.error("get all clients errors is", error);
            throw error;
        }
    }


    async getallcities() {
        try {
            const rows = await this.db.query(
                'SELECT * from ab_cities');

            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get all cities erros is", error)
            throw error;
        }
    }

    async searchCities(search?: string, stateId?: number) {
        try {
            if (search && search.trim().length) {
                return await this.db.query(
                    'SELECT * FROM ab_cities WHERE city_name LIKE ? AND state_id=?',
                    [`%${search.trim()}%`, stateId],
                );
            }

            return await this.db.query('SELECT * FROM ab_cities');
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("search cities erros is", error)
            throw error;
        }
    }

    async getCityById(stateId: number) {
        try {
            const rows = await this.db.query(
                'SELECT * FROM ab_cities WHERE state_id = ?',
                [stateId],
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);
            console.error("get state by id error is", error)
            throw error;
        }
    }

    async getallstates() {
        try {
            const rows = await this.db.query(
                'SELECT * from ab_states');

            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get all states erros is", error)
            throw error;
        }
    }

    async searchStates(search?: string) {
        try {
            if (search && search.trim().length) {
                return await this.db.query(
                    'SELECT * FROM ab_states WHERE state_name LIKE ?',
                    [`%${search.trim()}%`],
                );
            }

            return await this.db.query('SELECT * FROM ab_states');
        }

        catch (error) {
            Sentry.captureException(error);

            console.error("search states erros is", error)
            throw error;
        }

    }


    async UpdateById(CID: number, dto: UpdateClientDto, userid: number) {

        console.log("dto is in updateById ", dto);
        const filteredDto = Object.fromEntries(  //This converts the array of pairs back into an object.
            Object.entries(dto).filter(([_, value]) => value !== undefined), // converts dto object to array of key value pair
        );

        const fields = Object.keys(filteredDto);

        // 🔐 If password exists → hash it
        if (filteredDto.password) {
            filteredDto.password = await bcrypt.hash(filteredDto.password, 10);
        }

        if (!fields.length) {
            throw new Error('Nothing to update'); // ✅ throw instead
        }

        const setClause = fields
            .map((field) => `${field} = ?`)
            .join(', ');

        // 🔥 Convert remaining values (safe)
        console.log("set clause is", setClause)
        const values = Object.values(filteredDto);

        const sql = `
    UPDATE ab_customer
    SET ${setClause}, modified_date = NOW(),modified_by=?
    WHERE customer_id = ?
  `;

        const result = await this.db.query<ResultSetHeader>(
            sql,
            [...values, userid, CID],
        );

        return result; // 👈 IMPORTANT
    }


    private formatCreateDate(date: any, timezone: string): string | null {
        if (!date) return null;
        console.log("inside formatCreateDate");

        return (typeof date === 'string'
            ? DateTime.fromISO(date)
            : DateTime.fromJSDate(date)
        )
            .setZone(timezone)
            .toFormat("yyyy-MM-dd HH:mm:ss");
    }

    async insertClient(data: any, userId: number, conn: any) {
        const db = conn ?? this.db;


        try {
            const payload: any = { ...data, created_by: userId };

            if (payload.created_date) {
                payload.created_date = this.formatCreateDate(
                    payload.created_date,
                    "Asia/Kolkata"
                );
            } else {
                payload.created_date = DateTime.now()
                    .setZone("Asia/Kolkata")
                    .toFormat("yyyy-MM-dd HH:mm:ss");
            }

            console.log("incorrect date is", payload.created_date);

            delete payload.remove_adhar;
            delete payload.remove_pan;
            delete payload.remove_photo;
            delete payload.cust_id;



            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    payload[key] = null;
                }
            });

            const columns = Object.keys(payload).join(", ");
            const placeholders = Object.keys(payload).map(() => "?").join(", ");
            const values = Object.values(payload);

            return await db.query(
                `INSERT INTO clients (${columns}) VALUES (${placeholders})`,
                values
            );

        }
        catch (error) {
            
            Sentry.captureException(error);

            console.error("updateBeneficiary error is", error)
            if (error.code === "ER_DUP_ENTRY") {

                const msg = error.sqlMessage;

                if (msg?.includes("u_aadhar")) {
                    throw new ConflictException("Adhar Card already exists");
                }

                if (msg?.includes("u_pan")) {
                    throw new ConflictException("Pan Card Already Exists");
                }

                throw new ConflictException("Duplicate value detected");
            }

            throw error;

        }
    }

    async updateFilesPath(cid: number, files: any) {
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
             UPDATE clients
              SET ${fields.join(', ')}
              WHERE cl_id = ?
            `;

            values.push(cid);

            const result = await this.db.query<ResultSetHeader>(sql, values);

            return result;

        } catch (error) {
            Sentry.captureException(error);

            console.error("UpdateFilepath error", error);
            if (error.code === "ER_DUP_ENTRY") {

                const msg = error.sqlMessage;

                if (msg?.includes("u_aadhar")) {
                    throw new ConflictException("Adhar Card already exists");
                }

                if (msg?.includes("u_pan")) {
                    throw new ConflictException("Pan Card Already Exists");
                }

                throw new ConflictException("Duplicate value detected");
            }
            throw error;

        }
    }


    async getClinetById(cid: number) {
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


    async updateClient(
        cid: number,
        dto: any,
        filePaths: any,
        userid: number,
    ) {


        // merge dto + file paths
        try {

            const updateData = {
                ...dto,
                ...filePaths,
            };

            // ❗ remove flags (not DB columns)
            delete updateData.remove_adhar;
            delete updateData.remove_pan;
            delete updateData.remove_photo


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
        UPDATE clients
        SET ${setClause}
        WHERE cl_id = ?
      `;

            const result = await this.db.query<ResultSetHeader>(sql, [...values, cid]);

            return result;

        }
        catch (error) {
            Sentry.captureException(error);

            console.error("Client update error is", error)
            if (error.code === "ER_DUP_ENTRY") {

                const msg = error.sqlMessage;

                if (msg?.includes("u_aadhar")) {
                    throw new ConflictException("Adhar Card already exists");
                }

                if (msg?.includes("u_pan")) {
                    throw new ConflictException("Pan Card Already Exists");
                }

                throw new ConflictException("Duplicate value detected");
            }

            throw error;
        }

    }

    async deleteClient(id: number) {
        console.log("inside deleteClient repository")
        try {
            const rows = await this.db.query<ResultSetHeader>('delete from clients where cl_id=? limit 1', [id]);
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("failed to delete client", error);
        }
    }


    async getTotalCount(userid: number): Promise<number> {
        try {
            const rows = await this.db.query<number>(
                `
  SELECT COUNT(*) as total
  FROM clients
  WHERE compc_id=${userid}
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


    async getFilteredCountSearch(search: string, userid: number): Promise<number> {
        try {
            const rows = await this.db.query<number>(
                `SELECT COUNT(*) as total  FROM clients 
        WHERE cust_id = ?  AND (full_name LIKE ? 
       OR mobile_no LIKE ?)`,
                [userid, `%${search}%`, `%${search}%`],
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
            const where: string[] = ['cl.compc_id=?'];
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
      FROM clients cl
      LEFT JOIN customers a ON cl.created_by = a.customer_id
      LEFT JOIN customers a2 ON cl.modified_by = a2.customer_id
       LEFT JOIN ab_cities ct ON cl.city = ct.city_id
      LEFT JOIN ab_states st ON cl.state = st.state_id
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
            const where: string[] = ['cl.compc_id=?'];
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
        SELECT cl.*,
            a.cust_name AS created_by_name,
        a2.cust_name AS modified_by_name,
         ct.city_name AS city_name,
        st.state_name AS state_name,
         COUNT(CASE WHEN l.loan_status = 'active' THEN 1 END) AS active_loans,
            COUNT(CASE WHEN l.loan_status = 'close' THEN 1 END) AS closed_loans,
            COUNT(CASE WHEN l.loan_status = 'overdue' THEN 1 END) AS overdue_loans,
                     -- Total Loan Amount
            COALESCE(SUM(l.total_amount), 0) AS total_loan_amount

        FROM clients cl
           LEFT JOIN customers a ON cl.created_by = a.customer_id
      LEFT JOIN customers a2 ON cl.modified_by = a2.customer_id
       LEFT JOIN ab_cities ct ON cl.city = ct.city_id
      LEFT JOIN ab_states st ON cl.state = st.state_id
     LEFT JOIN loans l ON l.client_id = cl.cl_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        GROUP BY cl.cl_id
        ORDER BY cl.cl_id DESC
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
      SELECT cl.*,
      a.cust_name AS created_by_name,
        a2.cust_name AS modified_by_name,
        st.state_name AS state_name,

            COUNT(CASE WHEN l.loan_status = 'active' THEN 1 END) AS active_loans,
            COUNT(CASE WHEN l.loan_status = 'close' THEN 1 END) AS closed_loans,
            COUNT(CASE WHEN l.loan_status = 'overdue' THEN 1 END) AS overdue_loans,
                     -- Total Loan Amount
            COALESCE(SUM(l.total_amount), 0) AS total_loan_amount
      FROM clients cl
      LEFT JOIN customers a ON cl.created_by = a.customer_id
      LEFT JOIN customers a2 ON cl.modified_by = a2.customer_id
      LEFT JOIN ab_states st ON cl.state = st.state_id
      LEFT JOIN loans l 
      ON l.client_id = cl.cl_id
      WHERE cl.compc_id=${userid}
      GROUP BY cl.cl_id
      ORDER BY cl_id DESC
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


    async deletClientId(cid: number) {
        try {
            const rows = await this.db.query(
                `UPDATE clients
  SET status = ?
  WHERE cl_id = ?
  AND NOT EXISTS (
      SELECT 1
      FROM loans
      WHERE client_id = ?
      AND loan_status <> 'close'
  )
  LIMIT 1`,
                ['inactive', cid, cid]
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("delete by id error is", error)
        }
    }


    async deletClientPermanately(cid: number) {
        try {

            const result = await this.db.query(
                `
            DELETE FROM clients
            WHERE cl_id = ?
            AND NOT EXISTS (
                SELECT 1
                FROM loans
                WHERE client_id = ?
            )
            LIMIT 1
            `,
                [cid, cid]
            );

            return result;

        } catch (error) {
            Sentry.captureException(error);

            console.error("delete by id error is", error);
            throw error;
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
                throw new NotFoundException("Prefix Not Found for Customer");
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

}