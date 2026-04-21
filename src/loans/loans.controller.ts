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
            { name: 'gold_item', maxCount: 20 }
        ]),
    )
    async CreateLoan(@Body('data') data: string,
        @Headers('comp-id') companyId: string,

        @Req() req: any,
        @UploadedFiles()
        files: {
            gold_item?: Express.Multer.File[];
        },) {
                    const companyIdNum = Number(companyId);


        const loanDto = JSON.parse(data);

        const userId = req.user.userId;

        return this.loanServ.createLoan(
            loanDto,
            files,
            userId,
            companyIdNum,
        );
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
        ]),
    )
    async updateLoan(
        @Param('id') loanId: number,
        @Body('data') data: string,
        @Req() req: any,
        @UploadedFiles()
        files: {
            gold_item?: Express.Multer.File[];
        },
    ) {
        const dto = JSON.parse(data);
        const userId = req.user.userId;

        return this.loanServ.updateLoan(
            Number(loanId),
            dto,
            files,
            userId,
        );
    }


    @Get('get_loan/:id')
    async getTrainingData(
        @Param('id', ParseIntPipe) id: number) {
        return this.loanServ.getLoanById(id)
    }


    @Post("search-loan")
    @UseGuards(AuthGuard('jwt'))
    async searchLoan(@Query("search") search: string, @Query('page') page = '1',
        @Query('limit') limit = '10', @Req() req: any,@Headers('comp-id') companyId: string,

    ) {

        const userid = req.user.userId;
                const companyIdNum = Number(companyId);


        return this.loanServ.searchLoans(search, Number(page),
            Number(limit), companyIdNum);
    }
}
