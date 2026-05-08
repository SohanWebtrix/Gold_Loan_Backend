/* eslint-disable prettier/prettier */
import { Body, Controller, Headers, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
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
        return this.settingservice.CreatePrefix(dto.prefix,companyIdNum);
    }

      @Put('update_prefix')
      @UseGuards(AuthGuard('jwt'))
      async UpdatePrefix(@Body() dto: any, @Req() req: any,@Headers('comp-id') companyId: string
    
    ) {
        const customerIdNumber = Number(companyId);
    
        const userId = req.user.userId;
        return this.settingservice.UpdatePrefix(dto.prefix,customerIdNumber, userId);
      }

        @Put('update_company/:compnay_id')
        @UseGuards(AuthGuard('jwt'))
        async UpdateCompany(@Body() dto: any, @Req() req: any,@Param('compnay_id') company_id: string
      
      ) {
          const compid = Number(company_id);
          const userId = req.user.userId;

          return this.settingservice.UpdateCompany(dto,compid, userId);
        }

}
