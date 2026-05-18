/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { LoansService } from './loans.service';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CreateLoanDto } from './createLoan.dto';

@Controller('loans')
export class LoansController {

    constructor(private readonly loanServ: LoansService) {

    }

    
    @Post('create_loan')
    @UseGuards(AuthGuard('jwt'))

    @UseInterceptors(
        FileFieldsInterceptor([ //basically for processing file on server
            { name: 'gold_item', maxCount: 20 },
            { name: 'payment_proof_file', maxCount: 1 }
        ]),
    )
    async CreateLoan(@Body('data') data: string,
        @Headers('comp-id') companyId: string,

        @Req() req: any,
        @UploadedFiles()
        files: {
            gold_item?: Express.Multer.File[];
            payment_proof_file?: Express.Multer.File[];
        },) {
        const companyIdNum = Number(companyId);

        const loanDto = JSON.parse(data);
        const transactionFIle = files?.payment_proof_file?.[0];

        const userId = req.user.userId;

        return this.loanServ.createLoan(
            loanDto,
            files,
            transactionFIle,
            userId,
            companyIdNum,
        );
    }



    @Get('get_all_loans')
    @UseGuards(AuthGuard('jwt'))

    async getAllLoans(@Req() req: any,
        @Headers('comp-id') companyId: string,
    ) {
        const userId = req.user.userId;
        const companyIdNum = Number(companyId);

        return this.loanServ.getAllLoan(companyIdNum)
    }

    @Get('get_bank_account')

    async getAllBanks() {
        return this.loanServ.getAllAccount()
    }


    @Post('list')
    @UseGuards(AuthGuard('jwt'))
    async getLoans(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
        @Headers('comp-id') companyId: string,

        @Req() req: any,

    ) {

        const companyIdNum = Number(companyId);
        console.log("comapny id in loan list is",companyIdNum)

        const userid = req.user.userId;

        return this.loanServ.getLoanList(
            Number(page),
            Number(limit),
            filters,
            companyIdNum
        );

    }


    // loans.controller.ts
    @Put('update_loan/:id')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'gold_item', maxCount: 20 },
            { name: 'payment_proof_file', maxCount: 1 }
        ]),
    )
    async updateLoan(
        @Param('id') loanId: number,
        @Body('data') data: string,
        @Req() req: any,
        @UploadedFiles()
        files: {
            gold_item?: Express.Multer.File[];
            payment_proof_file?: Express.Multer.File[];
        },
    ) {

        const transactionFIle = files?.payment_proof_file?.[0];

        const dto = JSON.parse(data);
        const userId = req.user.userId;

        return this.loanServ.updateLoan(
            Number(loanId),
            dto,
            files,
            transactionFIle,
            userId,
        );
    }


    @Get('get_loan/:id')
    async getLoanByiId(
        @Param('id', ParseIntPipe) id: number) {
        return this.loanServ.getLoanById(id)
    }

    @Get('mortgaged_recpt/:loanId')
    @UseGuards(AuthGuard('jwt'))
    async getMortgageItemsByLoanId(
        @Param('loanId', ParseIntPipe) loanId: number,
    ) {
        return this.loanServ.getMortgageItemsByLoanId(loanId);
    }

        @Get('loan_recpt/:loanId')
    @UseGuards(AuthGuard('jwt'))
    async getLoanRecpt(
        @Param('loanId', ParseIntPipe) loanId: number,
    ) {
        return this.loanServ.getLoanRecpt(loanId);
    }

    @Post('client_summary/:clientId')
    @UseGuards(AuthGuard('jwt'))
    async getClientLoanSummary(
        @Param('clientId', ParseIntPipe) clientId: number,
        @Headers('comp-id') companyId: string,
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
    ) {

        const companyIdNum = Number(companyId);
        const pageNum = Number(page);
        const limitNum = Number(limit);
        return this.loanServ.getClientLoanSummary(clientId, companyIdNum, pageNum, limitNum, filters);
   
    }

    @Post("search-loan")
    @UseGuards(AuthGuard('jwt'))
    async searchLoan(@Query("search") search: string, @Query('page') page = '1',
        @Query('limit') limit = '10', @Req() req: any, @Headers('comp-id') companyId: string,

    ) {

        const userid = req.user.userId;
        const companyIdNum = Number(companyId);
        return this.loanServ.searchLoans(search, Number(page),
            Number(limit), companyIdNum);
    }



    @Post('searchLoansmobile')
@UseGuards(AuthGuard('jwt'))
async searchLoans(
  @Query('page') page = '1',
  @Query('limit') limit = '10',

  @Body('search') search: string,

  @Headers('comp-id') companyId: string,
) {

  return this.loanServ.searchLoansmobile(
    search,
    Number(page),
    Number(limit),
    Number(companyId),
  );
}
}
