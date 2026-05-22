/* eslint-disable prettier/prettier */


import { DatabaseService } from "src/database/database.service";
import * as bcrypt from 'bcrypt';
import { ResultSetHeader } from "mysql2";
import { ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { OPERATOR_SQL } from "src/filter/operator.map";
import * as Sentry from '@sentry/node';


@Injectable()
export class AdminRepository {

    constructor(private readonly db: DatabaseService) { }

  async insertBank(
            data: any,company_id:number,userId:number,
        ) {
            try {
    
                const payload: any = {
                    ...data,
                    company_id:company_id,
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
    
                const result = await this.db.query<ResultSetHeader>(
                    `INSERT INTO bank_account (${columns}) VALUES (${placeholders})`,
                    values
                );
    
                return result;
    
            } catch (error: any) {
    
                Sentry.captureException(error);
    
                console.error("❌ insert bank  DB error:", error);
    
    
                throw new InternalServerErrorException(
                    "Failed to create bank"
                );
            }
        }
    
        async getFilteredCountSearch(search: string, userid: number): Promise<number> {
                try {
                    const rows = await this.db.query<number>(
                        `SELECT COUNT(*) as total  FROM company 
                    WHERE company_name LIKE ? `,
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


            async getSearchCompany(page: number, limit: number, search: string, userid: number) {
                try {
                    const rows: any = await this.db.query(
                        `SELECT * FROM company 
               company_name LIKE ? `,
                        [`%${search}%`],
                    );
        
                    return rows;
                } catch (error) {
                    Sentry.captureException(error);
        
                    console.error('search bank error', error);
                    throw error;
                }
            }


        async getBankByid(aid: number) {
            try {
                const rows = await this.db.query(
                    `SELECT * from admins WHERE admin_id = ? LIMIT 1`,
                    [aid]
                );
                return rows;
            }
            catch (error) {
                Sentry.captureException(error);
    
                console.error("get bank by id erros is", error)
                throw error;
            }
        }

            async getAdminByid(aid: number) {
            try {
                const rows = await this.db.query(
                    `SELECT * from admins WHERE admin_id = ? LIMIT 1`,
                    [aid]
                );
                return rows;
            }
            catch (error) {
                Sentry.captureException(error);
    
                console.error("get admin by id erros is", error)
                throw error;
            }
        }

    async insertAdmin(data: any, userid: number) {

        try {
            const { first_name, last_name, user_name, admin_email, admin_phone, admin_password, role } = data;

            // 🔐 Hash password
            const hashedPassword = admin_password ? await bcrypt.hash(admin_password, 10) : null;



            const result = await this.db.query<ResultSetHeader>(
                `
     INSERT INTO admins
    (
      first_name,
      last_name,
      user_name,
      admin_email,
      admin_phone,
      admin_password,
      role,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?,?,?)
    `,
                [
                    first_name ?? null,
                    last_name ?? null,
                    user_name ?? null,
                    admin_email ?? null,
                    admin_phone ?? null,
                    hashedPassword ?? null,
                    role,
                    userid
                ],
            );

            return result;

        }
        catch (error) {
            // Sentry.captureException(error);

            console.error("Create user  error is", error)
            if (error.code === "ER_DUP_ENTRY") {

                const msg = error.sqlMessage;

                if (msg.includes("unique_email")) {
                    throw new ConflictException("Email ID already exists");
                }


                throw new ConflictException("Duplicate value detected");
            }


            throw new InternalServerErrorException(
                "Failed to create admin"
            );
        }
    }



    async updateAdmin(
        adminid: number,
        dto: any,
        userid: number,

    ) {

        // merge dto + file paths
        try {

            const updateData = {
                ...dto
            };



            // remove undefined
            const filteredData = Object.fromEntries(
                Object.entries(updateData).filter(([_, value]) => value !== undefined),
            );



            const { modified_date, ...restDto } = filteredData;


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
        UPDATE admins
        SET ${setClause}
        WHERE admin_id = ?
      `;

            const result = await this.db.query<ResultSetHeader>(sql, [...values, adminid]);

            return result;

        }
        catch (error) {

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

    async getTotalCount(): Promise<number> {
        try {
            const sql = `SELECT COUNT(*) as total FROM admins`;
            const result = await this.db.query(sql);
            return result[0]?.total ?? 0;
        } catch (error) {
            console.error("getTotalCount error is", error);
            throw error;
        }
    }

    async getFilteredCount(filters: any[]): Promise<number> {
        try {
            const where: string[] = [];
            const values: any[] = [];

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
              FROM admins ad
              ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            `;

            const result = await this.db.query(sql, values);
            return result[0]?.total ?? 0;
        }
        catch (error) {
            console.error("getFilteredCount is", error)
            throw error;
        }
    }

    async findWithFilters(filters: any[], page: number, limit: number) {
        try {

            const where: string[] = [];
            const values: any[] = [];

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
                SELECT ad.*
                FROM admins ad
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY ad.admin_id DESC
                LIMIT ${safeLimit} OFFSET ${safeOffset}
              `;

            const rows = await this.db.query(sql, values);
            return rows;
        }
        catch (error) {
            console.error("FindWithFilters error is", error)
            throw error;
        }
    }

    async findAll(page: number, limit: number) {
        try {
            const safeLimit = Number(limit);
            const safeOffset = Number((page - 1) * limit);

            if (isNaN(safeLimit) || isNaN(safeOffset)) {
                throw new Error('Invalid pagination parameters');
            }

            const sql = `
              SELECT ad.*
              FROM admins ad
              ORDER BY ad.admin_id DESC
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


   async getTotalCountbank(company_id:number): Promise<number> {
        try {
            const sql = `SELECT COUNT(*) as total FROM bank_account where company_id=?`;
            const result = await this.db.query(sql,[company_id]);
            return result[0]?.total ?? 0;
            
        } catch (error) {

            console.error("getTotalCount error is", error);
            throw error;

        }
    }

      async getFilteredCountbank(filters: any[],companyid:number): Promise<number> {
        try {
            const where: string[] = ['bk.company_id'];
            const values: any[] = [companyid];

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
              FROM bank_account bk
              ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            `;

            const result = await this.db.query(sql, values);
            return result[0]?.total ?? 0;
        }
        catch (error) {
            console.error("getFilteredCount is", error)
            throw error;
        }
    }

    async findWithFiltersbank(filters: any[], page: number, limit: number,companyid:number) {
        try {

            const where: string[] = ['bk.company_id'];
            const values: any[] = [companyid];

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
                SELECT bk.*
                FROM bank_account bk
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY bk.id DESC
                LIMIT ${safeLimit} OFFSET ${safeOffset}
              `;

            const rows = await this.db.query(sql, values);
            return rows;

        }
        catch (error) {
            console.error("FindWithFilters error is", error)
            throw error;
        }
    }

    async findAllbank(page: number, limit: number,companyid:number) {
        try {
            const safeLimit = Number(limit);
            const safeOffset = Number((page - 1) * limit);

            if (isNaN(safeLimit) || isNaN(safeOffset)) {
                throw new Error('Invalid pagination parameters');
            }

            const sql = `
              SELECT bk.*
              FROM bank_account bk
              where company_id=?
              ORDER BY bk.id DESC
              LIMIT ${safeLimit} OFFSET ${safeOffset} 
            `;

            const rows = await this.db.query(sql,[companyid]);
            return rows;
        }
        catch (error) {
            console.error("findAll is", error)
            throw error
        }
    }
}

