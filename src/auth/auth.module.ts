import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository/auth.repository';
import { DatabaseModule } from 'src/database/database.module';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from 'src/mail/mail.module';


@Module({
  imports: [PassportModule,   JwtModule.registerAsync({ //jwtModule provides jwtModule and jwtService i.e this.jwtService.sign(),jwt.jwtService.verify()
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
    ConfigModule,
  MailModule,],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository,JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
