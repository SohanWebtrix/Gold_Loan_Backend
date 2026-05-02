/* eslint-disable prettier/prettier */
import { Body, Controller, Param, Post, Put } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {

      constructor(private readonly adminService: AdminService) {}

        @Post('create_admin')
        async CreateAdmin(@Body() dto:any) {
          return this.adminService.CreateAdmin(dto);
        }

        @Put('update_admin/:id')
        async UpdateAdmin(@Body() dto:any,@Param('id') id:string) {
          return this.adminService.updateAdmin(dto,Number(id));
        }

}