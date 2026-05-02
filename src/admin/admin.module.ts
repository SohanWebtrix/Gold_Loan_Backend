import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository/admin.repository';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  imports:[DatabaseModule,]
})
export class AdminModule {}
