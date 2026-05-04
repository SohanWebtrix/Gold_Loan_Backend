/* eslint-disable prettier/prettier */
import { InternalServerErrorException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import * as Sentry from '@sentry/node';


export class SettingRepository {

        constructor(private readonly db: DatabaseService) { }
    
        
            async insertprefixbulk(
                prefix: any[],
                comapny_id: number) {
        
        
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
        
                    const result = await this.db.bulkQuery(sql, [values]);
        
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

}
