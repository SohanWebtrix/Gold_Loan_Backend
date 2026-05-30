/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { OPERATOR_SQL } from "src/filter/operator.map";
import { DateTime } from 'luxon';
import * as bcrypt from 'bcrypt';
import { ResultSetHeader } from "mysql2";
import * as Sentry from '@sentry/node';


@Injectable()

export class CustomersRepository {

    constructor(private readonly db: DatabaseService) {

    }



    async deleteCustomer(customerid: number) {

        try {

            const result = await this.db.query(`update customers set status="inactive" where customer_id=?`, [customerid]);
            return result;

        }

        catch (error) {

            Sentry.captureException(error);
            console.error("delete customer error is",error);

        }
    }

    async getCountforCustomer(customerId: any) {

        try {

            const rows: any = await this.db.query(`SELECT 
    c.customer_id,
    c.first_name,
    c.last_name,
    c.user_name,
    c.cust_phone,
    cm.company_name as company_name,

    -- total clients created
    COUNT(DISTINCT cl.cl_id) AS total_clients,

    -- total loans
    COUNT(l.loan_id) AS total_loans,

    -- active loans only
    COUNT(
        CASE 
            WHEN l.loan_status = 'active' 
            THEN 1 
        END
    ) AS active_loans

FROM customers c

LEFT JOIN clients cl 
    ON cl.created_by = c.customer_id

LEFT JOIN company cm 
    ON c.comp_id = cm.company_id

LEFT JOIN loans l 
    ON l.client_id = cl.cl_id

WHERE c.customer_id = ?

GROUP BY c.customer_id;`, [customerId])

            return rows[0];

        }

        catch (error) {
            Sentry.captureException(error);


            console.error("error during getCountforCustomer is", error)
            throw error;
        }
    }

    async getCustoemrdetails(customerid: number) {

        try {
            const rows = await this.db.query(
                `SELECT * from customers where customer_id=?
             `, [customerid]
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get customer by id error is", error);
            throw error;
        }
    }


    async getCompanyByid(userid: number) {
        try {
            const rows = await this.db.query(
                'SELECT comp_id FROM customers WHERE customer_id = ? LIMIT 1',
                [userid]
            );
            return rows;
        }
        catch (error) {
            Sentry.captureException(error);

            console.error("get company by id erros is", error)
            throw error;
        }
    }


    



    async getStaffById(staffId: number) {
        try {
            const rows = await this.db.query(
                'SELECT * FROM customers WHERE customer_id = ? LIMIT 1',
                [staffId],
            );
            return rows[0] || null;
        } catch (error) {
            Sentry.captureException(error);

            console.error('getStaffById error', error);
            throw error;
        }
    }

    async insertStaff(data: any, userId: number, companyId: number) {
        try {
            const cust_password = data.cust_password
                ? await bcrypt.hash(data.cust_password, 10)
                : null;

                
            const cust_name =
                [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || null;

            const created_date = DateTime.now()
                .toUTC()
                .toFormat('yyyy-MM-dd HH:mm:ss');

            const payload: Record<string, any> = {
                comp_id: companyId,
                first_name: data.first_name,
                last_name: data.last_name,
                user_name: data.user_name?.trim() || null,
                cust_name,
                role: data.role ?? 'staff',
                status: data.status ?? 1,
                address_line1: data.address_line1,
                address_line2: data.address_line2,
                state: data.state,
                city: data.city,
                pincode: data.pincode,
                cust_phone: data.cust_phone,
                cust_email: data.cust_email?.trim() || null,
                profile_pic_path: data.profile_pic_path,
                cust_password,
                created_by: userId,
                created_date,
                subscription_end_date:data.subscription_end_date,
            };

            const columns = Object.keys(payload);
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((key) => payload[key] === undefined ? null : payload[key]);

            const result = await this.db.query(
                `
            INSERT INTO customers (
                ${columns.join(',\n')}
            )
            VALUES (${placeholders})
            `,
                values,
            );

            return result;
        } catch (error) {
            Sentry.captureException(error);

            console.error('insertStaff error', error);
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
            Sentry.captureException(error);

            console.error('updateStaff error', error);
            throw error;
        }
    }

    async updateFilesPath(staffid: number, files: any) {
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
                 UPDATE customers
                  SET ${fields.join(', ')}
                  WHERE customer_id = ?
                `;

            values.push(staffid);

            const result = await this.db.query<ResultSetHeader>(sql, values);

            return result;

        } catch (error) {
            Sentry.captureException(error);

            console.error('updateStaff error', error);
            throw error;

        }
    }


    async deleteStaff(staffId: number) {
        try {
            const result = await this.db.query(
                'DELETE FROM customers WHERE customer_id = ?',
                [staffId],
            );
            return result;
        } catch (error) {
            Sentry.captureException(error);

            console.error('deleteStaff error', error);
            throw error;
        }
    }

    async getFilteredCount(filters: any[], userid: number) {

        try {
            const where: string[] = ['cs.role = ?'];
            const values: any[] = ['Admin'];

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
                  SELECT count(*)as total,
                ct.city_name AS city_name,
                st.state_name AS state_name,
                cm.company_name as company_name,
                cm.company_mobile as company_mobile,
                cm.company_email as company_email
              FROM customers cs
              LEFT JOIN ab_cities ct ON cs.city = ct.city_id
              LEFT JOIN ab_states st ON cs.state = st.state_id
              LEFT JOIN company cm on cs.comp_id=cm.company_id
              
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

            const where: string[] = ['cs.role = ?'];
            const values: any[] = ['Admin'];

            filters.forEach((f) => {
                let value = f.value;

                  const isClientNameFilter = f.column === "CONCAT(cs.first_name, ' ', cs.last_name)";

                if (isClientNameFilter) {
                    let value = f.value;
                    if (f.operator === 'contains') value = `%${value}%`;
                    if (f.operator === 'starts_with') value = `${value}%`;
                    if (f.operator === 'ends_with') value = `%${value}`;

                    if (f.operator === 'equals') {
                        where.push(
                            `(cs.first_name = ? OR cs.last_name = ? OR CONCAT(cs.first_name, ' ', cs.last_name) = ?)`
                        );
                        values.push(value, value, value);
                        return;
                    }

                    where.push(
                        `(cs.first_name ${OPERATOR_SQL[f.operator]} ? OR cs.last_name ${OPERATOR_SQL[f.operator]} ? OR CONCAT(cs.first_name, ' ', cs.last_name) ${OPERATOR_SQL[f.operator]} ?)`
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
               SELECT cs.*,
                ct.city_name AS city_name,
                st.state_name AS state_name,
                cm.company_name as company_name,
                cm.company_mobile as company_mobile,
                cm.company_email as company_email
              FROM customers cs
              LEFT JOIN ab_cities ct ON cs.city = ct.city_id
              LEFT JOIN ab_states st ON cs.state = st.state_id
              LEFT JOIN company cm on cs.comp_id=cm.company_id

                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY cs.customer_id DESC
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
              SELECT cs.*,
                ct.city_name AS city_name,
                st.state_name AS state_name,
                cm.company_name as company_name,
                cm.company_mobile as company_mobile,
                cm.company_email as company_email
              FROM customers cs
              LEFT JOIN ab_cities ct ON cs.city = ct.city_id
              LEFT JOIN ab_states st ON cs.state = st.state_id
              LEFT JOIN company cm on cs.comp_id=cm.company_id
              where cs.role='Admin'
                GROUP BY cs.customer_id
            
              ORDER BY customer_id DESC
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

    async findAllCustid(page: number, limit: number, compid: number) {

        try {
            const safeLimit = Number(limit);
            const safeOffset = Number((page - 1) * limit);

            if (isNaN(safeLimit) || isNaN(safeOffset)) {
                throw new Error('Invalid pagination parameters');
            }

            const sql = `
              SELECT cs.*,
                ct.city_name AS city_name,
                st.state_name AS state_name,
                cm.company_name as company_name,
                cm.company_mobile as company_mobile,
                cm.company_email as company_email
              FROM customers cs
              LEFT JOIN ab_cities ct ON cs.city = ct.city_id
              LEFT JOIN ab_states st ON cs.state = st.state_id
              LEFT JOIN company cm on cs.comp_id=cm.company_id
              where cs.comp_id=${compid}
                GROUP BY cs.customer_id
            
              ORDER BY customer_id DESC
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


    async getFilteredCountCustid(filters: any[], compid: number) {



        try {
            const where: string[] = ['cs.comp_id=?'];
            const values: any[] = [compid];

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
              SELECT COUNT(DISTINCT cs.customer_id) as total
              FROM customers cs
              LEFT JOIN ab_cities ct ON cs.city = ct.city_id
              LEFT JOIN ab_states st ON cs.state = st.state_id
              LEFT JOIN company cm on cs.comp_id=cm.company_id
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


    async findWithFiltersCustId(filters: any[], page: number, limit: number, compid: number) {

        try {

            const where: string[] = ['cs.comp_id = ?'];
            const values: any[] = [compid];

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
               SELECT cs.*,
                ct.city_name AS city_name,
                st.state_name AS state_name,
                cm.company_name as company_name,
                cm.company_mobile as company_mobile,
                cm.company_email as company_email
              FROM customers cs
              LEFT JOIN ab_cities ct ON cs.city = ct.city_id
              LEFT JOIN ab_states st ON cs.state = st.state_id
              LEFT JOIN company cm on cs.comp_id=cm.company_id

                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                GROUP BY cs.customer_id
                ORDER BY cs.customer_id DESC
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


    async getTotalCount(userid: number): Promise<number> {
        try {
            const rows = await this.db.query<number>(
                `
              SELECT COUNT(*) as total
              FROM customers where role='Admin'
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

    async getTotalCountByid(userid: number): Promise<number> {

        try {
            const rows = await this.db.query<number>(
                `
              SELECT COUNT(*) as total
              FROM customers
              WHERE comp_id = ?
              `,
                [userid],
            );

            return rows[0].total;

        }

        catch (error) {
            Sentry.captureException(error);

            console.error("getTotalCount error is", error)
            throw error;
        }
    }

}
