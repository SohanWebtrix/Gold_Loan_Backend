/* eslint-disable prettier/prettier */
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { OPERATOR_SQL } from "src/filter/operator.map";


@Injectable()

export class CustomersRepository {

    constructor(private readonly db: DatabaseService) {

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
            console.error("get company by id erros is", error)
            throw error;
        }
    }



    async getFilteredCount(filters: any[], userid: number) {
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
              FROM clients cl
              LEFT JOIN customers a ON cl.created_by = a.customer_id
              LEFT JOIN customers a2 ON cl.modified_by = a2.customer_id
               LEFT JOIN ab_cities ct ON cl.city = ct.city_id
              LEFT JOIN ab_states st ON cl.state = st.state_id
                 LEFT JOIN company cm on cs.comp_id=cm.company_id
                GROUP BY cs.customer_id
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
                  cm.company_name as company_name,
                cm.company_mobile as company_mobile,
                cm.company_email as company_email
                FROM clients cl
                   LEFT JOIN customers a ON cl.created_by = a.customer_id
              LEFT JOIN customers a2 ON cl.modified_by = a2.customer_id
               LEFT JOIN ab_cities ct ON cl.city = ct.city_id
              LEFT JOIN ab_states st ON cl.state = st.state_id
                            LEFT JOIN company cm on cs.comp_id=cm.company_id

                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY cl.cl_id DESC
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
                GROUP BY cs.customer_id
        
              ORDER BY customer_id DESC
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


    async getTotalCount(userid: number): Promise<number> {
        try {
            const rows = await this.db.query<number>(
                `
              SELECT COUNT(*) as total
              FROM customers
              `
            );
            return rows[0].total;

        }

        catch (error) {

            console.error("getTotalCount error is", error)
            throw error;
        }
    }


}
