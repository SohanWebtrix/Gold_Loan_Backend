/* eslint-disable prettier/prettier */
import { Body, Controller, Param, Post, Put, UseGuards, Query, Headers, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('admin')
export class AdminController {

      constructor(private readonly adminService: AdminService) {}

        @Post('create_admin')
        @UseGuards(AuthGuard('jwt'))

        async CreateAdmin(@Body() dto:any,@Req() req: any,) {

          const userid = req.user.userId;

          return this.adminService.CreateAdmin(dto,userid);
        }

        @Put('update_admin/:id')
        @UseGuards(AuthGuard('jwt'))

        async UpdateAdmin(@Body() dto:any,@Param('id') id:string,         @Req() req: any,
        ) {

                      const userid = req.user.userId;

          return this.adminService.updateAdmin(dto,Number(id),userid);
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



}