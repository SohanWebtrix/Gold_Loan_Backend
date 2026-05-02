/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AdminRepository } from './admin.repository/admin.repository';
import { DateTime } from 'luxon';

@Injectable()
export class AdminService {

      constructor(
            private readonly adminRepo: AdminRepository,
        ) {
    
        }


      async CreateAdmin(dto: any) {
    
            try {
                const result: any = await this.adminRepo.insertAdmin(dto);
    
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

        async updateAdmin(dto:any,adminid:number)
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


            const result = await this.adminRepo.updateAdmin(adminid,{...dto,modified_date})
            
        }
}
