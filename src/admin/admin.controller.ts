/* eslint-disable prettier/prettier */
import { Body, Controller, Param, Post, Put, UseGuards, Query, Headers, Req, Get, ParseIntPipe } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('admin')
export class AdminController {

  constructor(private readonly adminService: AdminService) { }


    @Post("search_company")
    @UseGuards(AuthGuard('jwt'))
    async searchBank(@Query("search") search: string, @Query('page') page = '1',
        @Query('limit') limit = '10', @Req() req: any, @Headers('comp-id') companyId: string,

    ) {

        const userid = req.user.userId;
        const companyIdNum = Number(companyId);
        return this.adminService.searchComapany(search, Number(page),
            Number(limit), companyIdNum);
    }



  @Post('create_admin')
  @UseGuards(AuthGuard('jwt'))

  async CreateAdmin(@Body() dto: any, @Req() req: any,) {

    const userid = req.user.userId;

    return this.adminService.CreateAdmin(dto, userid);
  }

  @Put('update_admin/:id')
  @UseGuards(AuthGuard('jwt'))

  async UpdateAdmin(@Body() dto: any, @Param('id') id: string, @Req() req: any,
  ) {

    const userid = req.user.userId;

    return this.adminService.updateAdmin(dto, Number(id), userid);
  }

  @Post('list')
  @UseGuards(AuthGuard('jwt'))
  async getAdminList(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Body('filters') filters: any[] = [],
  ) {
    
    return this.adminService.getAdminList(
      Number(page),
      Number(limit),
      filters,
    );
    
  }

   @Get('get_admin/:id')
    async getAdmin(
        @Param('id', ParseIntPipe) id: number) {

        return this.adminService.getAdminById(id)
    }

         @Post('create_bank')
        @UseGuards(AuthGuard('jwt'))
  async CreateBank(@Body() dto:any,@Req() req: any,@Headers('comp-id') companyId: string) {

    const userid = req.user.userId;
    const companyIdNum = Number(companyId);

    return this.adminService.CreateBank(dto,userid,companyIdNum);

  }


     @Get('get_bank/:id')
    async getBank(
        @Param('id', ParseIntPipe) id: number) {

        return this.adminService.getBankById(id)
    }

     @Post('listbank')
    @UseGuards(AuthGuard('jwt'))
    async getCustomers(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
        @Headers('comp-id') companyId: string,
    ) {

        const companyIdNum = Number(companyId);

        return this.adminService.getBankList(
            Number(page),
            Number(limit),
            filters,
            companyIdNum
        );
    }

}