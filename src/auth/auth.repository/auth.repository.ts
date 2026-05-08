/* eslint-disable prettier/prettier */


import { DatabaseService } from "src/database/database.service";
import { AuthDto } from "../auth.dto";
import { ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";
import * as bcrypt from 'bcrypt';
import { ResultSetHeader } from "mysql2";
import { DateTime } from "luxon";
import * as Sentry from '@sentry/node';

type Customer = {
    customer_id: number;
    password: string;
};

type CustomerId = {
    customer_id: number;
};


type OtpRecord = {
    id: number;
    email: string;
    otp_hash: string;
    expires_at: Date;
    attempts: number;
    verified: boolean; // or boolean if DB uses tinyint(1)
    purpose: string;
};

export type LoginUserType = {
    customer_id: number;
    comp_id: number;
    cust_phone: number;
    cust_email: string;
    cust_name: string;
    cust_password: string;
    status: string; // or 'active' | 'inactive' if you know values
    role: string;
    profile_pic_path: string;

};

export type CustomerWithCompany = {
    customer_id: number;
    comp_id: number;
    first_name: string | null;
    last_name: string | null;
    status: number | string | null;
    address_line1: string | null;
    address_line2: string | null;
    state: string | null;
    city: string | null;
    pincode: string | null;
    cust_phone: string | number | null;
    cust_email: string | null;
    user_name: string | null;
    company_id: number;
    company_name: string | null;
    company_email: string | null;
    company_mobile: string | null;
};

export type PrefixItem = {
    module: string;
    prefix: string;
    year: string | number;
    document_no: string | number;
};

@Injectable()

export class AuthRepository {

    constructor(private readonly db: DatabaseService) { }


    private formatDateForDB(date: any): string | null {
        if (!date) return null;

        return (typeof date === 'string'
            ? DateTime.fromISO(date)
            : DateTime.fromJSDate(date)
        )
            .toUTC()
            .toFormat("yyyy-MM-dd HH:mm:ss");
    }


    // REPOSITORY

    async insertprefixbulk(
        prefix: any[],
        comapny_id: number,
        conn: any) {

        const db = conn ?? this.db;

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

            const result = await db.query(sql, [values]);

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

    async insertprefixbulku(
        prefix: any[],
        comapny_id: number,
        conn: any) {

        const db = conn ?? this.db;


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

            const [result] = await db.query(sql, [values]);

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


    async deletePrefixes(company_id: number, conn?: any) {
        const db = conn ?? this.db;

        try {
            const result = await db.query(
                `DELETE FROM prefix_table WHERE company_id = ?`,
                [company_id],
            );
            return result;
        } catch (error: any) {
            Sentry.captureException(error);

            console.error('deletePrefixes error', error);
            throw new InternalServerErrorException('Failed to delete prefixes');
        }
    }

    async updateCompany(companyId: number, data: any, userId: number, conn?: any) {
        const db = conn ?? this.db;

        try {
            const fields: string[] = [];
            const values: any[] = [];

            const companyFields = {
                company_name: data.company_name,
                company_email: data.company_email,
                company_mobile: data.company_mobile,
            };

            Object.entries(companyFields).forEach(([key, value]) => {
                if (value !== undefined) {
                    fields.push(`${key} = ?`);
                    values.push(value);
                }
            });

            if (fields.length === 0) return;

            fields.push('modified_by = ?');
            values.push(userId);
            fields.push('modified_date = ?');
            values.push(this.formatDateForDB(new Date()));

            const sql = `UPDATE company SET ${fields.join(', ')} WHERE company_id = ?`;
            await db.query(sql, [...values, companyId]);
        } catch (error: any) {
            Sentry.captureException(error);

            console.error('updateCompany error', error);
            throw error;
        }
    }

    async updateCustomer(customerId: number, data: any, userId: number, conn?: any) {
        const db = conn ?? this.db;

        try {
            const fields: string[] = [];
            const values: any[] = [];

            const customerFields: any = {
                first_name: data.first_name,
                last_name: data.last_name,
                status: data.status,
                address_line1: data.address_line1,
                address_line2: data.address_line2,
                state: data.state,
                city: data.city,
                pincode: data.pincode,
                cust_phone: data.cust_phone,
                cust_email: data.cust_email,
                user_name: data.username,
            };

            Object.entries(customerFields).forEach(([key, value]) => {
                if (value !== undefined) {
                    fields.push(`${key} = ?`);
                    values.push(value);
                }
            });

            if (data.cust_password) {
                const hashedPassword = await bcrypt.hash(data.cust_password, 10);
                fields.push('cust_password = ?');
                values.push(hashedPassword);
            }

            if (fields.length === 0) return;

            fields.push('modified_by = ?');
            values.push(userId);
            fields.push('modified_date = ?');
            values.push(this.formatDateForDB(new Date()));

            const sql = `UPDATE customers SET ${fields.join(', ')} WHERE customer_id = ?`;
            await db.query(sql, [...values, customerId]);
        } catch (error: any) {
            Sentry.captureException(error);

            console.error('updateCustomer error', error);
            throw error;
        }
    }


    async insertAdmin(data: any) {

        try {
            const { admin_name, username, admin_email, admin_password } = data;

            // 🔐 Hash password
            const hashedPassword = admin_password ? await bcrypt.hash(admin_password, 10) : null;



            const result = await this.db.query<ResultSetHeader>(
                `
     INSERT INTO admins
    (
      admin_name,
      user_name,
      admin_email,
      admin_password
    )
    VALUES (?, ?, ?, ?)
    `,
                [
                    admin_name ?? null,
                    username ?? null,
                    admin_email ?? null,
                    hashedPassword ?? null,
                ],
            );

            return result;

        }
        catch (error) {
            Sentry.captureException(error);

            console.error("Create user  error is", error)
            if (error.code === "ER_DUP_ENTRY") {

                const msg = error.sqlMessage;

                if (msg.includes("unique_email")) {
                    throw new ConflictException("Email ID already exists");
                }


                throw new ConflictException("Duplicate value detected");
            }


            throw new InternalServerErrorException(
                "Failed to create beneficiary"
            );
        }
    }

    // Insert Company (Manual Query)
    async insertCompany(data: any, userId: number, conn: any) {
                const db = conn ?? this.db;

        try {
            const company_email = data.company_email || null;
            const company_mobile = data.company_mobile || null;
            const company_name = data.company_name || null;


            const created_date = DateTime.now()
                .toUTC()
                .toFormat("yyyy-MM-dd HH:mm:ss");

            const result = await db.query(
                `
            INSERT INTO company
            (
                company_name,
                company_email,
                company_mobile,
                created_by,
                created_date
            )
            VALUES (?,?, ?, ?, ?)
            `,
                [
                    company_name,
                    company_email,
                    company_mobile,
                    userId,
                    created_date
                ]
            );

            return result;
        } catch (error) {
            Sentry.captureException(error);

            console.error("insertCompany error", error);
            throw error;
        }
    }


    // Insert Customer (Manual Query)
    async insertCustomer(
        data: any,
        userId: number,
        company_id: number,
        conn: any
    ) {
                const db = conn ?? this.db;

        try {
            const cust_password = data.cust_password
                ? await bcrypt.hash(data.cust_password, 10)
                : null;

            const created_date = DateTime.now()
                .toUTC()
                .toFormat("yyyy-MM-dd HH:mm:ss");

            const result = await db.query(
                `
            INSERT INTO customers
            (
                comp_id,
                first_name,
                last_name,
                status,
                address_line1,
                address_line2,
                state,
                city,
                pincode,
                cust_password,
                cust_phone,
                created_by,
                created_date
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [
                    company_id,
                    data.first_name || null,
                    data.last_name || null,
                    data.status || 1,
                    data.address_line1 || null,
                    data.address_line2 || null,
                    data.state || null,
                    data.city || null,
                    data.pincode || null,
                    cust_password,
                    data.cust_phone || null,
                    userId,
                    created_date
                ]
            );

            return result;
        } catch (error) {
            Sentry.captureException(error);

            console.error("insertCustomer error", error);
            throw error;
        }
    }



    async findCustomerWithCompany(customerId: number): Promise<CustomerWithCompany | null> {
        const rows = await this.db.query<CustomerWithCompany[]>(
            `
      SELECT
        cu.*,
        co.company_id AS company_id,
        co.company_name,
        co.company_email,
        co.company_mobile
      FROM customers cu
      JOIN company co ON cu.comp_id = co.company_id
      WHERE cu.customer_id = ?
      LIMIT 1
      `,
            [customerId],
        );

        return rows[0] || null;
    }

    async getPrefixesByCompany(companyId: number): Promise<PrefixItem[]> {
        const rows = await this.db.query<PrefixItem[]>(
            `
      SELECT
        doc_type AS module,
        prefix,
        year,
        last_no AS document_no
      FROM prefix_table
      WHERE company_id = ?
      `,
            [companyId],
        );

        return rows;
    }

    async isTokenBlacklisted(token: string): Promise<boolean> {

        if (!token) {
            return false;
        }

        const query = `
    SELECT id FROM token_blacklist
    WHERE token = ?
    LIMIT 1
  `;

        const rows: any = await this.db.query(query, [token]);

        return Array.isArray(rows) && rows.length > 0;
    }

    async loginemail(login_id: string): Promise<LoginUserType | null> {

        const rows = await this.db.query<LoginUserType[]>(
            `
  SELECT customer_id,comp_id, cust_name, cust_email, cust_password,status,cust_phone,role,profile_pic_path
  FROM customers 
  WHERE (cust_phone = ? OR user_name = ?) 
  LIMIT 1
  `,
            [login_id, login_id]
        );

        return rows[0] || null;
    }


    async loginemailadmin(login_id: string) {

        const rows = await this.db.query<ResultSetHeader>(
            `
  SELECT admin_id, first_name,last_name, admin_email, admin_password,status,admin_phone 
  FROM admins 
  WHERE (admin_phone = ? OR user_name = ?) 
  LIMIT 1
  `,
            [login_id, login_id]
        );

        return rows[0] || null;
    }




    async findemail(email: string): Promise<CustomerId | null> {

        try {
            const rows = await this.db.query<CustomerId[]>(
                `
  SELECT customer_id
  FROM ab_customer 
  WHERE email = ?
  LIMIT 1
  `,
                [email]
            );

            return rows[0] || null;
        }
        catch (error) {
            console.error("findemail error is", error)
            throw error;
        }
    }


    async insertOtp(email: string, hash: string, expiry: Date) {

        try {

            const result = await this.db.query<ResultSetHeader>(
                `
     INSERT INTO otp_login
    (
      email,
      otp_hash,
      expires_at,
      purpose
    )
    VALUES (?, ?, ?, ?)
    `,
                [
                    email,
                    hash,
                    expiry,
                    'RESET_PASSWORD'
                ],
            );

            return result;

        }
        catch (error) {
            // Sentry.captureException(error);

            console.error("Fail to insert otp", error)

            throw new InternalServerErrorException(
                "Failed to insert otp"
            );
        }
    }


    async findValidOTPEmail(email: string): Promise<OtpRecord[]> {

        try {
            const rows = await this.db.query<OtpRecord[]>(
                `SELECT * FROM otp_login
     WHERE email = ?
       AND expires_at >  UTC_TIMESTAMP()
       AND verified = 0
     ORDER BY id DESC
     LIMIT 1`,
                [email],
            );

            return rows;
        }
        catch (error) {
            console.error("findValidOtpEmail error is", error);
            throw error;
        }
    }


    async incrementAttempts(id: number) {
        try {
            await this.db.query(
                `UPDATE otp_login SET attempts = attempts + 1 WHERE id = ?`,
                [id],
            );
        }
        catch (error) {
            console.error("incremet attemps error is", error);
        }

    }

    async markVerified(id: number) {
        try {
            await this.db.query(`UPDATE otp_login SET verified = 1 WHERE id = ?`, [id]);
        }
        catch (error) {
            console.error("mark Verified error is", error)
        }
    }


    async getPassword(email: string): Promise<Customer | null> {
        try {
            const rows = await this.db.query<Customer[]>('SELECT customer_id, password FROM ab_customer WHERE email = ? limit 1', [email])
            return rows[0] || null;
        } catch (error) {
            console.error("get Password error is", error);
            throw error;
        }
    }

    async updatePass(hash: string, email: string) {
        try {
            const rows = await this.db.query<ResultSetHeader>(`UPDATE ab_customer SET password = ?, is_password_update = 'y' WHERE email = ?`,
                [hash, email],)

            return rows;
        } catch (error) {
            console.error("updatePass error is", error)
        }
    }


}
