/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SubscriptionService } from './subscription.service';


type JwtRequest = Request & { user: { userId: number } };

type MulterFile = {
    originalname: string;
    buffer: Buffer;
};


@Controller('subscription')
export class SubscriptionController {

    constructor(private readonly subservice: SubscriptionService) { }


    @Post('create_subscription/:id')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'transaction_img', maxCount: 1 },

        ]),
    )


    async createSub(
        @Body() dto: any,
        @Headers('comp-id') companyId: string,
        @Req() req: JwtRequest,
        @Param('id', ParseIntPipe) id: number,

        @UploadedFiles()
        files: {
            transaction_img?: Express.Multer.File[];
        },
    ): Promise<any> {

        const companyIdNum = Number(companyId);
        const comapnyid = Number(id);

        const userId = req.user.userId;
        const Transctionimg = files?.transaction_img?.[0];

        return await this.subservice.createSubscription(dto, Transctionimg, companyIdNum, userId, comapnyid);

    }


    @Put('update_subscription/:subid')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'transaction_img', maxCount: 1 },
        ]),
    )
    async updateStaff(
        @Param('subid') subid: string,
        @Body() dto: any,
        @Req() req: JwtRequest,
        @UploadedFiles()
        files: {
            transaction_img?: MulterFile[];
        },
    ): Promise<any> {

        const sbid = Number(subid);

        const userId = req.user.userId;

        const Transctionimg = files?.transaction_img?.[0];

        return await this.subservice.updateSubscription(sbid, dto, Transctionimg, userId);
    }


    @Get('get_subs/:cust_id')
    async getCustSubsById(
        @Param('cust_id', ParseIntPipe) custid: number) {
        return this.subservice.getSubByid(custid)
    }


    @Get('get_editsubs/:subid')
    async getSubsById(
        @Param('subid', ParseIntPipe) sbuid: number) {
        return this.subservice.getrealSubByid(sbuid)
    }


    @Post('list')
    @UseGuards(AuthGuard('jwt'))
    async getSubscriptions(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
        @Headers('comp-id') companyId: string,
    ) {

        const companyIdNum = Number(companyId);

        return this.subservice.getSubscriptionList(
            Number(page),
            Number(limit),
            filters,
            companyIdNum,
        );
    }


    @Post("search_company")
    @UseGuards(AuthGuard('jwt'))
    async searchByNameCustomer(@Query("search") search: string, @Req() req: any,
    ) {

        const userid = req.user.userId;

        return this.subservice.searchCompnay(search, userid);


    }

    @Get('getsubsbycustomerid/:id')
    async getSubsByCustomerId(
        @Param('id', ParseIntPipe) id: number) {

        const custid = Number(id);

        return this.subservice.getSubforcustomer(custid)

    }

}