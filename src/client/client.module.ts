import { Module } from '@nestjs/common';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { DatabaseModule } from 'src/database/database.module';
import { ClientRepository } from './client.repository/client.repository';
import { CustomersModule } from 'src/customers/customers.module';

@Module({
  imports: [DatabaseModule, CustomersModule],
  controllers: [ClientController],
  providers: [ClientService, ClientRepository],
})
export class UsersModule {}
