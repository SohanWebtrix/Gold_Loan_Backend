/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { SettingRepository } from './setting.repository/setting.repository';

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

        else{

            return{
                success:false,
                message:"fail to add prefix",
            }
        }
    }

}
