/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable } from '@nestjs/common';
import { CustomersRepository } from './customers.repository/customers.repository';

@Injectable()
export class CustomersService {

        constructor(private readonly customerRepo: CustomersRepository) {
    
      }

        async getClinetById(userId: number) {
      
          try {
      
            if (!userId) {
              throw new BadRequestException("customer id is missing");
            }
      
            const data = await this.customerRepo.getCompanyByid(userId);
      
            return {
              message: "data fetched succesfully"
              , data
            }
          }
          catch (error) {
            console.error("get user by id error is", error)
          }
        }
      
}
