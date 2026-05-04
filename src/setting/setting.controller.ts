/* eslint-disable prettier/prettier */
import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { SettingService } from './setting.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('setting')
export class SettingController {



    constructor(private readonly settingservice: SettingService) {

    }


    @Post('set_prefix')
    @UseGuards(AuthGuard('jwt'))
    async CreatePre(@Body() dto: any, @Req() req: any, @Headers('comp-id') companyId: string,
    ) {
        const companyIdNum = Number(companyId);

        return this.settingservice.CreatePrefix(dto,companyIdNum);
    }
}
