/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuthRepository } from './auth.repository/auth.repository';

@Injectable()
export class TokenCleanupService {
    constructor(private readonly authRepo: AuthRepository) { }

    @Cron('0 * * * *') // runs every hour
    async cleanupTokens() {

        await this.authRepo.deleteExpiredTokens();
    }

    @Cron('0 * * * *') // runs every hour
    async cleanupOTP() {

        await this.authRepo.deleteExpiredOtps();
    }
    
}