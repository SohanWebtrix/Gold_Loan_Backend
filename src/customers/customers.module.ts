/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { DatabaseModule } from 'src/database/database.module';
import { CustomersRepository } from './customers.repository/customers.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [CustomersController],
  providers: [CustomersService,CustomersRepository],
    exports: [CustomersRepository]   // 👈 export this

})
export class CustomersModule {}
