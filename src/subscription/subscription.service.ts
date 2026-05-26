/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository/subscription.repository';
import * as fs from 'fs';
import * as path from 'path';
import * as Sentry from '@sentry/node';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from 'src/database/database.service';
import { SUBSCRIPTION_FILTER_SCHEMA } from './subscription.filter.schema';


type MulterFile = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class SubscriptionService {


  constructor(private readonly subRepo: SubscriptionRepository, private readonly db: DatabaseService,
  ) {


  }

  async searchClient(search: string, page: number,
    limit: number, userid: number) {

    try {

      const totalRecords = await this.subRepo.getFilteredCountSearch(search, userid)

      console.log("total Records are", totalRecords)

      const totalPages = Math.ceil(totalRecords / limit);

      const data = await this.subRepo.getSearchClient(page, limit, search, userid);


      const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, totalRecords);


      console.log("total pages are ", totalPages)
      console.log("end is", end)


      if (!data || data.length === 0) {
        return {
          message: "no Client found",
          data: [],
        }
      }

      return {
        success: true,
        message: "Client fetched succesfully",
        currentPage: page,
        limit,
        start,
        end: end,
        totalRecords: totalRecords,
        totalPages: totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        data
      }
    } catch (error) {
      console.error("Search Client error", error)
      throw new InternalServerErrorException("Failed to get updated data",);
    }

  }



  async getSubByid(subid: number) {

    try {

      if (!subid) {
        throw new BadRequestException("subscription id is missing");
      }

      const data = await this.subRepo.getSubDetails(subid);

      return {
        message: "subscription details fetched succesfully"
        , data
      }
    }

    catch (error) {
      Sentry.captureException(error);

      console.error("get customer by id error is", error)
    }
  }


   async getSubforcustomer(id: number) {

    try {

      if (!id) {
        throw new BadRequestException("customer id is missing");
      }

      const data = await this.subRepo.getSubDetailsforcustomer(id);

      return {
        message: "subscription details fetched succesfully"
        , data
      }
      
    }

    catch (error) {
      Sentry.captureException(error);

      console.error("get customer by id error is", error)
    }
  }



  async updateSubscription(
    subid: number,
    dto: any,
    transactionFile: MulterFile | undefined,
    userId: number,
  ): Promise<any> {
    const uploadedFiles: string[] = [];
    const oldFilesToDelete: string[] = [];

    try {
      if (!Number.isInteger(subid) || subid <= 0) {
        throw new BadRequestException('Invalid subscription id');
      }

      if (Object.keys(dto).length === 0 && !transactionFile) {
        throw new BadRequestException('Update data is required');
      }

      const existingSubs = await this.subRepo.getSubsByid(subid);
      if (!existingSubs) {
        throw new BadRequestException('Staff not found');
      }

      console.log("existing staff is", existingSubs);

      const folderPath = `uploads/subscription/${subid}`;
      await fs.promises.mkdir(folderPath, { recursive: true });


      const profile = await this.replaceSubFile(
        transactionFile,
        subid,
        'subscription',
        folderPath,
        existingSubs.transaction_path,
        dto.remove_profile === 'true',
      );

      console.log("profile inside customer service is", profile);

      if (profile.filePath) {

        uploadedFiles.push(profile.filePath);

      }


      if (profile.oldFileToDelete) {
        oldFilesToDelete.push(profile.oldFileToDelete);
      }

      const fileUpdates: any = {};
      if (profile.dbPath !== undefined) {
        fileUpdates.transaction_path = profile.dbPath;
      }

      const payload = { ...dto, ...fileUpdates };




      const result = await this.db.transaction(async (conn) => {

        const updateResult = await this.subRepo.updateSubs(subid, payload, userId, conn);


        // 2️⃣ Insert into customer table with company_id
        await this.subRepo.updateCustomer(
          { subscription_end_date: dto.subscription_end_date, customer_id: dto.customer_id }, conn
        );

        return updateResult;

      })
      if (!result || result.affectedRows === 0) {
        throw new Error('Failed to update subscription');
      }

      await Promise.all(
        oldFilesToDelete.map(async (oldPath) => {
          const cleanPath = path.resolve(oldPath.replace(/^\/+/, ''));
          if (fs.existsSync(cleanPath)) {
            await fs.promises.unlink(cleanPath);
          }
        }),
      );

      return {
        message: 'subscription updated successfully',
        data: result,
      };
    } catch (error) {

      Sentry.captureException(error);

      console.error('update subscription error', error);

      await Promise.all(
        uploadedFiles.map(async (filePath) => {
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
          }
        }),
      );

      throw new InternalServerErrorException('Failed to update subscription');
    }
  }



  async createSubscription(
    dto: any,
    Transctionimg: MulterFile | undefined,
    companyId: number,
    userId: number,
    customerId: number

  ): Promise<any> {
    let folderPath: string | null = null;
    let subscriptid: number | null = null;

    try {

      const result = await this.db.transaction(async (conn) => {

        const subResult: any = await this.subRepo.insertSubscription(dto, userId, customerId, conn);

        const subid = subResult.insertId;

        // 2️⃣ Insert into customer table with company_id
        await this.subRepo.updateCustomer(
          { subscription_end_date: dto.subscription_end_date, customerId }, conn
        );

        return subid;
      })

      subscriptid = result;


      if (!subscriptid) {
        throw new Error('Failed to insert subscription');
      }

      if (Transctionimg) {

        folderPath = `uploads/subscription/${subscriptid}`;
        await fs.promises.mkdir(folderPath, { recursive: true });

        const { dbPath } = await this.savSubFile(Transctionimg, subscriptid, 'subscription', folderPath);

        if (dbPath) {
          const updateResult = await this.subRepo.updateFilesPath(subscriptid, { transaction_path: dbPath });

          if (!updateResult || updateResult.affectedRows !== 1) {
            throw new Error('subscription file update failed');
          }
        }
      }

      return {
        message: 'subscription created successfully',
      };
    } catch (error) {
      Sentry.captureException(error);

      console.error('createStaff error', error);

      if (folderPath && fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, { recursive: true, force: true });
      }


      if (subscriptid) {
        try {
          await this.subRepo.deleteSubscription(subscriptid);
        } catch (cleanupError) {
          console.error('Failed to cleanup subscription:', cleanupError);
        }
      }

      throw error;
    }
  }


  private async replaceSubFile(
    file: MulterFile | undefined,
    staffId: number,
    prefix: string,
    folderPath: string,
    oldFilePath?: string,
    removeFile?: boolean,
  ): Promise<{ dbPath?: string | null; filePath?: string | null; oldFileToDelete?: string | null }> {

    console.log("rmeove file in replace staff file is", removeFile);

    if (removeFile) {
      console.log("inside remove file in replaceStaffFile");

      return { dbPath: null, oldFileToDelete: oldFilePath ?? null };
    }

    console.log("folder path inside replace staff file is", folderPath);

    if (!file) {
      return {};
    }

    const allowedTypes = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException('Invalid file type');
    }

    const fileName = `${prefix}_${staffId}_${uuidv4()}${ext}`;
    const filePath = path.join(folderPath, fileName);
    const dbPath = `/${folderPath}/${fileName}`;

    console.log("dbPath is in replaceStaff is", dbPath);
    console.log("file path is", filePath);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      dbPath,
      filePath,
      oldFileToDelete: oldFilePath ?? null,
    };
  }


  private async savSubFile(
    file: MulterFile | undefined,
    staffId: number,
    prefix: string,
    folderPath: string,
  ): Promise<{ dbPath: string | null; filePath: string | null }> {
    if (!file) {
      return { dbPath: null, filePath: null };
    }

    const allowedTypes = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException('Invalid file type');
    }

    const fileName = `${prefix}_${staffId}_${uuidv4()}${ext}`;
    const filePath = path.join(folderPath, fileName);
    const dbPath = `/${folderPath}/${fileName}`;

    await fs.promises.writeFile(filePath, file.buffer);

    return { dbPath, filePath };
  }


  async getSubscriptionList(
    page: number,
    limit: number,
    filters: any[] = [],
    companyId: number,
  ) {
    try {

      if (page < 1) page = 1;
      if (limit < 1) limit = 10;

      const validatedFilters = filters.map((f) => {
        const schema = SUBSCRIPTION_FILTER_SCHEMA[f.field];

        if (!schema) {
          throw new Error(`Invalid filter field: ${f.field}`);
        }

        if (!schema.operators.includes(f.operator)) {
          throw new Error(
            `Invalid operator for field: ${f.field}`,
          );
        }

        return {
          column: schema.column,
          type: schema.type,
          operator: f.operator,
          value: f.value,
          valueTo: f.valueTo,
        };
      });

      const totalRecords =
        validatedFilters.length > 0
          ? await this.subRepo.getSubscriptionFilteredCount(
            validatedFilters,
            companyId,
          )
          : await this.subRepo.getSubscriptionTotalCount(
          );

      const totalPages = Math.ceil(
        totalRecords / limit,
      );

      const data =
        validatedFilters.length > 0
          ? await this.subRepo.findSubscriptionWithFilters(
            validatedFilters,
            page,
            limit,
          )
          : await this.subRepo.findAllSubscriptions(
            page,
            limit,
          );

      const start =
        totalRecords === 0
          ? 0
          : (page - 1) * limit + 1;

      const end = Math.min(
        page * limit,
        totalRecords,
      );

      return {
        currentPage: page,
        limit,
        start,
        end,
        totalRecords,
        totalPages,
        nextPage:
          page < totalPages ? page + 1 : null,
        previousPage:
          page > 1 ? page - 1 : null,
        data,
      };
    } catch (error) {
      Sentry.captureException(error);

      console.error(
        'getSubscriptionList error',
        error,
      );

      throw new InternalServerErrorException(
        'Failed to fetch subscription list',
      );
    }
  }
}
