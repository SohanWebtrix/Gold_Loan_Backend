/* eslint-disable prettier/prettier */

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './client/client.module';
import { LoansModule } from './loans/loans.module';
import { MortgagedModule } from './mortgaged/mortgaged.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CustomersController } from './customers/customers.controller';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ConfigModule.forRoot({
      isGlobal: true, // 👈 IMPORTANT
    }),
    MailModule,
    UsersModule,
    LoansModule,
    MortgagedModule,
    TransactionsModule,
    CustomersModule,
  ],
  controllers: [AppController, CustomersController],
  providers: [AppService],
})
export class AppModule { }
