/* eslint-disable prettier/prettier */
import { Body, Controller, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {

    constructor(private readonly transactionService: TransactionsService) { }


     @Post('list')
        @UseGuards(AuthGuard('jwt'))
        async getClients(
            @Query('page') page = '1',
            @Query('limit') limit = '10',
            @Body('filters') filters: any[] = [],
            @Req() req: any,
        ) {
    
            const userid = req.user.userId;
    
            return this.transactionService.getClientList(
                Number(page),
                Number(limit),
                filters,
                userid
            );
        }
}
