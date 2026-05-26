/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Headers, Param, Post, Put, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { SettingService } from './setting.service';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';


type MulterFile = {
    originalname: string;
    buffer: Buffer;
};


@Controller('setting')
export class SettingController {

  constructor(private readonly settingservice: SettingService) {

  }

  @Post('set_prefix')
  @UseGuards(AuthGuard('jwt'))
  async CreatePre(@Body() dto: any, @Req() req: any, @Headers('comp-id') companyId: string,
  ) {
    const companyIdNum = Number(companyId);
    return this.settingservice.CreatePrefix(dto.prefix, companyIdNum);
  }

  @Put('update_prefix')
  @UseGuards(AuthGuard('jwt'))
  async UpdatePrefix(@Body() dto: any, @Req() req: any, @Headers('comp-id') companyId: string

  ) {
    const customerIdNumber = Number(companyId);

    const userId = req.user.userId;
    return this.settingservice.UpdatePrefix(dto.prefix, customerIdNumber, userId);
  }


   @Put('update_profile/:profile_id')
        @UseGuards(AuthGuard('jwt'))
        @UseInterceptors(
            FileFieldsInterceptor([
                { name: 'profile_picture', maxCount: 1 },
            ]),
        )
        async updateProfile(
            @Param('profile_id') staffId: string,
            @Body() dto: any,
            @Req() req: any,
            @UploadedFiles()
            files: {
                profile_picture?: MulterFile[];
            },
        ): Promise<any> 
        {
            const staffIdNum = Number(staffId);
            const userId = req.user.userId;
            const profileFile = files?.profile_picture?.[0];
    
            return await this.settingservice.updateProfile(staffIdNum, dto, profileFile, userId);
        }


  @Get('get_profile/:customer_id')
  @UseGuards(AuthGuard('jwt'))
  async getCustomerDetails(
    @Param('customer_id') customerId: string,
    @Headers('comp-id') compIdHeader: string,
  ) {

    const customerIdNumber = Number(customerId);
    const compIdNumber = compIdHeader ? Number(compIdHeader) : undefined;
    return this.settingservice.getCustomerDetails(customerIdNumber, compIdNumber);
    
  }

  @Get('get_company')
  @UseGuards(AuthGuard('jwt'))
  async getCompany(
    @Headers('comp-id') compIdHeader: string,
  ) {

    const compIdNumber = compIdHeader ? Number(compIdHeader) : undefined;
    return this.settingservice.getCompanyDetails(compIdNumber);
    
  }

    @Get('get_prefix')
  @UseGuards(AuthGuard('jwt'))
  async getPrefix(
    @Headers('comp-id') compIdHeader: string,
  ) {

    const compIdNumber = compIdHeader ? Number(compIdHeader) : undefined;
    return this.settingservice.getPrefix(compIdNumber);
    
  }


@Put('update_company')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(
  FileFieldsInterceptor([
    { name: 'company_logo', maxCount: 1 },
  ]),
)
async UpdateCompany(
  @Body() dto: any,
  @Req() req: any,
  @Headers('comp-id') compIdHeader: string,

  @UploadedFiles()
  files: {
    company_logo?: MulterFile[];
  },
) {
  const companyId = Number(compIdHeader);
  const userId = req.user.userId;

  const logoFile = files?.company_logo?.[0];

  return this.settingservice.UpdateCompany(
    dto,
    companyId,
    userId,
    logoFile,
  );
}

}
