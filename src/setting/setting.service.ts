/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { SettingRepository } from './setting.repository/setting.repository';
import { error } from 'console';
import { DateTime } from 'luxon';

@Injectable()
export class SettingService {

    constructor(

        private readonly settingrepo: SettingRepository,
    ) {

    }

    async CreatePrefix(dto: any, comapnyid: number) {

        const insertPrefix = await this.settingrepo.insertprefixbulk(
            dto.prefix,
            comapnyid
        );

        if (insertPrefix && insertPrefix.affectedRows === 1) {
            return {
                success: true,
                message: "prefix added successfully",
            };
        }

        else {

            return {
                success: false,
                message: "fail to add prefix",
            }
        }
    }


    async UpdatePrefix(dto: any, companyid: number, userid: number) {

        for (const item of dto) {

            if (item.id && item.id != null) {
                await this.settingrepo
                    .updatePrefix(
                        item.id,
                        item,
                    );
            }
        }
    }

    async UpdateCompany(dto:any,comapnyid:number,userid:number)
    {

        try{

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


        const result= await this.settingrepo.updateComapny({dto,modified_date},comapnyid,userid);

        if(result.affectedRows!==1)
        {
            throw new error("fail to updated comapny")
        }
        return {
            success:true,
            message:"company updated succesfully",
        }
    }
    catch(error)
    {
        console.error("update company error is",error);
        throw error;
    }
    }

}
