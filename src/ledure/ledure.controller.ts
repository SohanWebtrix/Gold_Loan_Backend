/* eslint-disable prettier/prettier */
import { Body, Controller, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import { LedureService } from './ledure.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('ledger')
export class LedureController {

    constructor(private readonly ledureService: LedureService) { }
    
     @Post('list')
        @UseGuards(AuthGuard('jwt'))
        async getLedure(
            @Query('page') page = '1',
            @Query('limit') limit = '10',
            @Body('filters') filters: any[] = [],
            @Headers('comp-id') companyId: string,
            @Req() req: any,
        ) {
    
            const companyIdNum = Number(companyId);
    
            const userid = req.user.userId;
    
            return this.ledureService.getLedureList(
                Number(page),
                Number(limit),
                filters,
                companyIdNum
            );
        }
        
}
