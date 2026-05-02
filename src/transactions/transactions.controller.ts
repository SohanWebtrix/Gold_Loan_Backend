/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TransactionsService } from './transactions.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

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
                @Headers('comp-id') companyId: string,

    ) {

        const userid = req.user.userId;
                const companyIdNum = Number(companyId);

        return this.transactionService.getTransactionList(
            Number(page),
            Number(limit),
            filters,
            companyIdNum
        );
    }


    @Post('create_transaction')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(FileFieldsInterceptor([
        {name:'payment_proof_file',maxCount:1}])
    )
    async CreateTransaction(@Body() dto: any,
        @Headers('comp-id') companyId: string,
        @Req() req: any,
          @UploadedFiles()
                files: {
                    payment_proof_file?: Express.Multer.File[];
                },
    ) {
        const paymentproof=files?.payment_proof_file?.[0];
        const companyIdNum = Number(companyId);
        console.log("company Id is", companyIdNum);
        const userId = req.user.userId;

        return this.transactionService.createTransaction(
            dto,
            paymentproof,
            userId,
            companyIdNum,
        );
    }


    @Get('get_loan/:id')
    async getloanbyid(
        @Param('id', ParseIntPipe) id: number) {
        return this.transactionService.getLoanById(id)
    }



    @Post("search_client_transaction")
    @UseGuards(AuthGuard('jwt'))
    async searchByName(@Query("search") search: string, @Req() req: any, @Headers('comp-id') companyId: string,

    ) {

        const userid = req.user.userId;
        const companyIdNum = Number(companyId);

        return this.transactionService.searchClient(search, companyIdNum);
    }

    @Get("client_loans/:clientId")
    @UseGuards(AuthGuard('jwt'))
    async getClientLoans(
        @Param("clientId") clientId: string,
        @Headers("comp-id") companyId: string
    ) {
        return this.transactionService.getClientLoans(
            Number(clientId),
            Number(companyId)
        );
    }

     @Get("tranasactionrecipt/:transactionId")
    @UseGuards(AuthGuard('jwt'))
    async getRecipt(
        @Param("transactionId") transctionId: string,
        @Headers("comp-id") companyId: string
    ) {
        return this.transactionService.getReceipt(
            Number(transctionId),
            Number(companyId)
        );
    }

}
