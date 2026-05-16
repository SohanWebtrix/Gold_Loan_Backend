/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AdminRepository } from './admin.repository/admin.repository';
import { DateTime } from 'luxon';
import { ADMIN_FILTER_SCHEMA } from './admin.filter.schema';

@Injectable()
export class AdminService {

      constructor(
            private readonly adminRepo: AdminRepository,
        ) {
    
        }


          async getAdminById(aid: number) {

    try {

      if (!aid) {
        throw new BadRequestException("client id is missing");
      }

      const data = await this.adminRepo.getAdminByid(aid);

      return {
        message: "admin fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("fail to fetch client", error)
    }

  }

      async CreateAdmin(dto: any,userid:number) {
    
            try {
                const result: any = await this.adminRepo.insertAdmin(dto,userid);
    
                // 3️⃣ Check success
                if (result && result.affectedRows === 1) {
                    return {
                        success: true,
                        message: 'admin added successfully',
                        userId: result.insertId,
                    };
                }
    
                throw new InternalServerErrorException("Failed to add admin");
            }
            catch (error) {

                console.error("CreateAdmin error", error)
                throw error;

            } 
        }

        async updateAdmin(dto:any,adminid:number,userid:number)
        {
            if(!adminid)
            {
                throw new BadRequestException("admin id is not present");
            }

let modified_date: string;

      if (dto.modified_date) {
        const raw = dto.modified_date;
        modified_date = (typeof raw === 'string'
          ? DateTime.fromISO(raw)
          : DateTime.fromJSDate(raw as Date)
        )
          .toUTC()
          .toFormat("yyyy-MM-dd HH:mm:ss");
      } else {
        modified_date = DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss");
      }


            const result = await this.adminRepo.updateAdmin(adminid,{...dto,modified_date},userid)
            
        }

        async getAdminList(
          page: number,
          limit: number,
          filters: any[] = [],
        ) {
          try {

            if (page < 1) page = 1;
            if (limit < 1) limit = 10;

            // 🔑 MAP FILTERS HERE
            const validatedFilters = filters.map((f) => {
              const schema = ADMIN_FILTER_SCHEMA[f.field];

              if (!schema) {
                throw new Error(`Invalid filter field: ${f.field}`);
              }

              if (!schema.operators.includes(f.operator)) {
                throw new Error(`Invalid operator for field: ${f.field}`);
              }

              return {
                column: schema.column,
                type: schema.type,
                operator: f.operator,
                value: f.value,
                valueTo: f.valueTo
              };
            });

            const totalRecords =
              validatedFilters.length > 0
                ? await this.adminRepo.getFilteredCount(validatedFilters)
                : await this.adminRepo.getTotalCount();

            const totalPages = Math.ceil(totalRecords / limit);

            const data =
              validatedFilters.length > 0
                ? await this.adminRepo.findWithFilters(validatedFilters, page, limit)
                : await this.adminRepo.findAll(page, limit);

            const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
            const end = Math.min(page * limit, totalRecords);

            return {
              currentPage: page,
              limit,
              start,
              end,
              totalRecords,
              totalPages,
              nextPage: page < totalPages ? page + 1 : null,
              previousPage: page > 1 ? page - 1 : null,
              data,
            };
          }
          catch (error) {
            console.error("getAdminList error", error)
            throw new InternalServerErrorException("Failed to fetch Admin list");
          }
        }
}