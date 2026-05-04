/* eslint-disable prettier/prettier */
import { Body, Controller, Headers, Param, Post, Put, Query, Req, UseGuards, UseInterceptors, UploadedFiles, Get, ParseIntPipe } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CustomersService } from './customers.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

type JwtRequest = Request & { user: { userId: number } };

type MulterFile = {
    originalname: string;
    buffer: Buffer;
};

@Controller('customers')
export class CustomersController {
    constructor(private readonly customerService: CustomersService) { }

    @Post('create_staff')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'profile_picture', maxCount: 1 },
        ]),
    )
    async createStaff(
        @Body() dto: any,
        @Headers('comp-id') companyId: string,
        @Req() req: JwtRequest,
        @UploadedFiles()
        files: {
            profile_picture?: Express.Multer.File[];
        },
    ): Promise<any> {
        const companyIdNum = Number(companyId);
        const userId = req.user.userId;
        const profileFile = files?.profile_picture?.[0];

        return await this.customerService.createStaff(dto, profileFile, companyIdNum, userId);
    }

    @Put('update_staff/:staff_id')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'profile_picture', maxCount: 1 },
        ]),
    )
    async updateStaff(
        @Param('staff_id') staffId: string,
        @Body() dto: any,
        @Req() req: JwtRequest,
        @UploadedFiles()
        files: {
            profile_picture?: MulterFile[];
        },
    ): Promise<any> {
        const staffIdNum = Number(staffId);
        const userId = req.user.userId;
        const profileFile = files?.profile_picture?.[0];

        return await this.customerService.updateStaff(staffIdNum, dto, profileFile, userId);
    }

        @Get('get_staff/:id')
        async getCustomerById(
            @Param('id', ParseIntPipe) id: number) 
            {
            return this.customerService.getCustById(id)
            }

    @Post('list')
    @UseGuards(AuthGuard('jwt'))
    async getCustomers(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
        @Headers('comp-id') companyId: string,
    ) {
        const companyIdNum = Number(companyId);
        console.log("company id is", companyIdNum);

        return this.customerService.getCustomerList(
            Number(page),
            Number(limit),
            filters,
            companyIdNum
        );
    }


    @Post('list_cust')
    @UseGuards(AuthGuard('jwt'))
    async getCustomerbyid(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
        @Headers('comp-id') companyId: string,
    ) {

        const companyIdNum = Number(companyId);
        console.log("company id is", companyIdNum);

        return this.customerService.getCustomerListByid(
            Number(page),
            Number(limit),
            filters,
            companyIdNum
        );
    }


}
