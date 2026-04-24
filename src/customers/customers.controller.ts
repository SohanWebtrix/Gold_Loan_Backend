/* eslint-disable prettier/prettier */
import { Body, Controller, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('customers')
export class CustomersController {
constructor(private readonly customerService: CustomersService) { }

 @Post('list')
    @UseGuards(AuthGuard('jwt'))
    async getCustomers(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
        @Headers('comp-id') companyId: string,
        @Req() req: any,
    ) {

        const companyIdNum = Number(companyId);
        console.log("company id is", companyIdNum);

        const userid = req.user.userId;

        return this.customerService.getCustomerList(
            Number(page),
            Number(limit),
            filters,
            companyIdNum
        );
    }

}
