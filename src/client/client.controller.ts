/* eslint-disable prettier/prettier */
import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { ClientService } from './client.service';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CreateClientDto } from './client.createdto';
import { UpdateClientDto } from './client.updatedto';

@Controller('clients')
export class ClientController {

    constructor(private readonly clientService: ClientService) { }

    @Get('get_client/:id')
    async getClient(
        @Param('id', ParseIntPipe) id: number, @Headers('comp-id') companyId: string,
) {
            const companyIdNum = Number(companyId);

        return this.clientService.getClinetById(id,companyIdNum)
    }

    @Get('get_clients_loan/:id')
    async getClientsLoan(
        @Param('id', ParseIntPipe) id: number) {

        return this.clientService.getClinetLonsById(id)
    }

    @Get('get_all_client')
    @UseGuards(AuthGuard('jwt'))

    async getAllClient(@Req() req: any,
            @Headers('comp-id') companyId: string,
) {
        const userId = req.user.userId;
        const companyIdNum = Number(companyId);

        return this.clientService.getAllClient(companyIdNum)
    }

    @Get('get_states')
    async getAllState() {
        return this.clientService.getAllStates()
    }

@Get('search_cities')
async searchCities(
  @Query('search') search?: string,
  @Query('stateId') stateId?: string,
) {
  return this.clientService.searchCities(search, Number(stateId));
}

    @Get('get_cities/:state_id')
    async getAllStates(
        @Param('state_id', ParseIntPipe) stateId: number,
    ) {
        return this.clientService.getCityById(stateId)
    }

    @Get('search_states')
    async searchStates(@Query('search') search?: string) {
        return this.clientService.searchStates(search)
    }
    

    @Post('create_client')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FileFieldsInterceptor([ //basically for processing file on server
            { name: 'adhar_card', maxCount: 1 },
            { name: 'pan_card', maxCount: 1 },
            { name: 'passport_photo', maxCount: 1 },
        ]),
    )
    async CreateClinet(@Body() ClientDto: CreateClientDto,
        @Headers('comp-id') companyId: string,
        @Req() req: any,
        @UploadedFiles()
        files: {
            adhar_card?: Express.Multer.File[];
            pan_card?: Express.Multer.File[];
            passport_photo?: Express.Multer.File[];
        },) {
        const adharFile = files?.adhar_card?.[0];
        const panFile = files?.pan_card?.[0];
        const photoFile = files?.passport_photo?.[0];
        const companyIdNum = Number(companyId);

        const userId = req.user.userId;

        return this.clientService.createClient(
            ClientDto,
            adharFile,
            panFile,
            photoFile,
            userId,
            companyIdNum,
        );
    }

    @Post('list')
    @UseGuards(AuthGuard('jwt'))
    async getClients(
        @Query('page') page = '1',
        @Query('limit') limit = '10',
        @Body('filters') filters: any[] = [],
        @Headers('comp-id') companyId: string,
        @Req() req: any,
    ) {

        const companyIdNum = Number(companyId);

        const userid = req.user.userId;

        return this.clientService.getClientList(
            Number(page),
            Number(limit),
            filters,
            companyIdNum
        );
        
    }


    @Put('update_client/:id')
    @UseGuards(AuthGuard('jwt'))
    @UseInterceptors(
        FileFieldsInterceptor([ //basically for processing file on server
            { name: 'adhar_card', maxCount: 1 },
            { name: 'pan_card', maxCount: 1 },
            { name: 'passport_photo', maxCount: 1 },
        ]),
    )
    async UpdateClient(@Body() ClientDto: UpdateClientDto, @Param('id') id: string,
        @Req() req: any,
        @UploadedFiles()
        files: {
            adhar_card?: Express.Multer.File[];
            pan_card?: Express.Multer.File[];
            passport_photo?: Express.Multer.File[];
        },) {
        const adharFile = files?.adhar_card?.[0];
        const panFile = files?.pan_card?.[0];
        const photoFile = files?.passport_photo?.[0];

        const userId = req.user.userId;

        return this.clientService.updateClient(
            ClientDto,
            adharFile,
            panFile,
            photoFile,
            Number(id),
            userId,
        );
    }


    @Put('delete_client/:id')
    async deleteClient(@Param('id', ParseIntPipe) id: number,) {

        return this.clientService.deleteClient(id)

    }


        @Delete('delete_client_permanatly/:id')
    async deleteClientPermanately(@Param('id', ParseIntPipe) id: number,) {

        return this.clientService.deleteClientPer(id)

    }

    @Post("search-client")
    @UseGuards(AuthGuard('jwt'))
    async searchByNamemob(@Query("search") search: string, @Query('page') page = '1',
        @Query('limit') limit = '10', @Req() req: any,
    ) {

        const userid = req.user.userId;

        return this.clientService.searchClient(search, Number(page),
            Number(limit), userid);
    }

        @Post("search_client_loan")
    @UseGuards(AuthGuard('jwt'))
    async searchByName(@Query("search") search: string, @Req() req: any, @Headers('comp-id') companyId: string,

    ) {
        const userid = req.user.userId;
        const companyIdNum = Number(companyId);
    
        return this.clientService.searchClientloan(search, companyIdNum);
    }

}
