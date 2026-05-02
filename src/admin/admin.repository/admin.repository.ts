import { DatabaseService } from "src/database/database.service";
import * as bcrypt from 'bcrypt';
import { ResultSetHeader } from "mysql2";
import { ConflictException, InternalServerErrorException } from "@nestjs/common";

/* eslint-disable prettier/prettier */
export class AdminRepository {

    constructor(private readonly db: DatabaseService) { }


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



    async updateAdmin(
        adminid: number,
        dto: any,

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
            values.push(adminid);


            const sql = `
        UPDATE admins
        SET ${setClause}
        WHERE cl_id = ?
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
}
