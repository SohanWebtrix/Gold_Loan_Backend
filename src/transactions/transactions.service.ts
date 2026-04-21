/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { TRANSACTION_FILTER_SCHEMA } from './transaction.filter.schema';
import { TransactionRepository } from './transaction.repository/transaction.repository';

@Injectable()
export class TransactionsService {


  constructor(private readonly transactionrepo: TransactionRepository) {

  }
  
  
    async getClientList(
      page: number,
      limit: number,
      filters: any[] = [],
      userid: number
    ) {
      try {
  
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
  
        // 🔑 MAP FILTERS HERE
        const validatedFilters = filters.map((f) => {
          const schema = TRANSACTION_FILTER_SCHEMA[f.field];
  
          if (!schema) {
            throw new Error(`Invalid filter field: ${f.field}`);
          }
  
          if (!schema.operators.includes(f.operator)) {
            throw new Error(`Invalid operator for field: ${f.field}`);
          }
  
          return {
            column: schema.column,
            type: schema.type,
            operator: f.operator,
            value: f.value,
          };
        });
  
  
        const totalRecords =
          validatedFilters.length > 0
            ? await this.transactionrepo.getFilteredCount(validatedFilters, userid)
            : await this.transactionrepo.getTotalCount(userid);
  
        const totalPages = Math.ceil(totalRecords / limit);
  
        const data =
          validatedFilters.length > 0
            ? await this.transactionrepo.findWithFilters(validatedFilters, page, limit, userid)
            : await this.transactionrepo.findAll(page, limit, userid);
  
        const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
        const end = Math.min(page * limit, totalRecords);
  
        return {
          currentPage: page,
          limit,
          start,
          end,
          totalRecords,
          totalPages,
          nextPage: page < totalPages ? page + 1 : null,
          previousPage: page > 1 ? page - 1 : null,
          data,
        };
      }
      catch (error) {
  
        console.error("getTransaction error", error)
        throw new InternalServerErrorException("Failed to fetch transaction list");
  
      }
    }

}
