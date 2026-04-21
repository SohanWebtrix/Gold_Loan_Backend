/* eslint-disable prettier/prettier */


import { DatabaseService } from "src/database/database.service";
import { AuthDto } from "../auth.dto";
import { ConflictException, Injectable, InternalServerErrorException } from "@nestjs/common";
import * as bcrypt from 'bcrypt';
import { ResultSetHeader } from "mysql2";

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
  comp_id:number;
  cust_phone:number;
  cust_email: string;
  cust_name: string;
  cust_password: string;
  status: string; // or 'active' | 'inactive' if you know values
};


@Injectable()

export class AuthRepository {

    constructor(private readonly db: DatabaseService) { }


    async insertUser(data: AuthDto) {

        try {
            const { cust_name, username, cust_email, cust_password } = data;

            // 🔐 Hash password
            const hashedPassword = cust_password ? await bcrypt.hash(cust_password, 10) : null;

   

            const result = await this.db.query<ResultSetHeader>(
                `
     INSERT INTO customers
    (
      cust_name,
      user_name,
      cust_email,
      cust_password
    )
    VALUES (?, ?, ?, ?)
    `,
                [
                    cust_name ?? null,
                    username ?? null,
                    cust_email ?? null,
                    hashedPassword ?? null,
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
                "Failed to create beneficiary"
            );
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
                "Failed to create beneficiary"
            );
        }
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

    async loginemail(login_id: string): Promise<LoginUserType |null> {

        const rows = await this.db.query<LoginUserType[]>(
            `
  SELECT customer_id,comp_id, cust_name, cust_email, cust_password,status,cust_phone 
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
  SELECT admin_id, admin_name, admin_email, admin_password,status,admin_phone 
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
