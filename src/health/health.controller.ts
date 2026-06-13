/* eslint-disable prettier/prettier */
import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Controller()

export class HealthController {
    
  constructor(private readonly db: DatabaseService) {}
  
@Get('health')
async health() {
  try {
    await this.db.query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}


}