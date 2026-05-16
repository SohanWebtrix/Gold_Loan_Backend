/* eslint-disable prettier/prettier */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LedureRepository } from './ledure.repository/ledure.repository';
import { LEDURE_FILTER_SCHEMA } from './ledure.schema';
import * as Sentry from '@sentry/node';


@Injectable()
export class LedureService {

  constructor(private readonly ledurerepo: LedureRepository) {

  }

  async getLedureList(
    page: number,
    limit: number,
    filters: any[] = [],
    userid: number
  ) {

    // const customer = await this.customerRepo.findById(userId);
    // const companyId = customer.comp_id;

    try {

      if (page < 1) page = 1;
      if (limit < 1) limit = 10;

      // 🔑 MAP FILTERS HERE
      const validatedFilters = filters.map((f) => {
        const schema = LEDURE_FILTER_SCHEMA[f.field];

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
          valueTo: f.valueTo
        };
      });


      const totalRecords =
        validatedFilters.length > 0
          ? await this.ledurerepo.getFilteredCount(validatedFilters, userid)
          : await this.ledurerepo.getTotalCount(userid);

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.ledurerepo.findWithFilters(validatedFilters, page, limit, userid)
          : await this.ledurerepo.findAll(page, limit, userid);

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

                  Sentry.captureException(error);
      
      console.error("get ledure list error", error)
      throw new InternalServerErrorException("Failed to fetch ledure list");

    }
  }
}
