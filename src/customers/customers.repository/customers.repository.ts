/* eslint-disable prettier/prettier */
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";


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
}
