/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from 'src/database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { LoanRepository } from './loan.repository/loan.repository';
import * as Sentry from '@sentry/node';
import { LOAN_FILTER_SCHEMA } from './loan.filter.schema';
import { randomBytes } from "crypto";
import { DateTime } from 'luxon';



@Injectable()
export class LoansService {
  constructor(
    private readonly db: DatabaseService,
    private readonly loanRepo: LoanRepository,
  ) { }


  async searchLoans(search: string, page: number,
    limit: number, userid: number) {
    try {


      const totalRecords = await this.loanRepo.getFilteredCountSearch(search, userid)

      console.log("total Records are", totalRecords)

      const totalPages = Math.ceil(totalRecords / limit);

      const data = await this.loanRepo.getSearchLons(page, limit, search, userid);


      const start = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, totalRecords);


      console.log("total pages are ", totalPages)
      console.log("end is", end)


      if (!data || data.length === 0) {
        return {
          message: "no loans found",
          data: [],
        }
      }

      return {
        success: true,
        message: "loans fetched succesfully",
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

  private generateClientCode(): string {
    const year = new Date().getFullYear();
    const randomPart = randomBytes(3).toString("hex").toUpperCase(); // 6 chars

    return `GL-${year}-${randomPart}`;
  }

  async createLoan(dto: any, files: any, userId: number,companyIdNum:number) {

    let uploadedPaths: string[] = [];
    let loanId: number | null = null;

    try {

      dto.loan_document_number = this.generateClientCode()
      dto.compl_id=companyIdNum;
      // STEP 1: Insert loan first
      const loanRes = await this.loanRepo.insertLoan(dto, userId);
      console.log("loan id in loanRes is", loanRes)

      loanId = loanRes.insertId;

      if (loanId === null) {
        throw new Error('Loan ID not generated');
      }

      const finalLoanId = loanId;
      // STEP 2: Folder path
      const folderPath = `uploads/gold/${userId}/${dto.client_id}/${loanId}`;

      await fs.promises.mkdir(folderPath, { recursive: true });

      // STEP 3: Upload files
      const mortgageItems = await Promise.all(
        dto.mortgaged_items.map(async (item, index) => {

          const file = files?.gold_item?.[index];

          if (!file) {
            throw new BadRequestException(
              `Gold image required for item ${index + 1}`
            );
          }


          const imgPath = await this.saveFile(
            file,
            'gold',
            folderPath
          );

          console.log("img path is ", imgPath)

          if (imgPath) {
            uploadedPaths.push(imgPath);
          }

          console.log("upload path for createLoan is",uploadedPaths);

          return {
            ...item,
            gold_item: imgPath
          };
        })
      );

      // STEP 4: Transaction only for child tables
      await this.db.transaction(async (conn) => {

        if (dto.nominees?.length) {
          await this.loanRepo.insertNomineesBulk(
            finalLoanId,
            dto.nominees,
            conn
          );
        }

        if (mortgageItems?.length) {
          await this.loanRepo.insertMortgageItemsBulk(
            finalLoanId,
            mortgageItems,
            conn
          );
        }
      });

      return {
        success: true,
        message: "Loan created successfully",
        loan_id: loanId
      };

    } catch (error) {

      // Delete uploaded files
      for (const filePath of uploadedPaths) {

                const finalPaths = path.resolve(filePath.replace(/^[/\\]+/, ''));

        if (fs.existsSync(finalPaths)) {
          await fs.promises.unlink(finalPaths);
        }
      }

      // Delete loan row if created
      if (loanId) {
        await this.loanRepo.deleteLoan(loanId);
      }

      throw error;
    }
  }

  // loans.service.ts

  async updateLoan(
    loanId: number,
    dto: any,
    files: any,
    userId: number,
  ) {

    let newUploads: string[] = [];
    let oldFilesToDelete: string[] = [];

    try {

      // ==========================================
      // STEP 1: Validate Loan Exists
      // ==========================================
      const loan =
        await this.loanRepo.getLoanById(
          loanId
        );


      console.log("loan is", loan)
      console.log("loan client id is", loan.client_id)

      // ==========================================
      // STEP 2: Folder Path
      // ==========================================
      const folderPath =
        `uploads/gold/${userId}/${loan.client_id}/${loanId}`;

      await fs.promises.mkdir(
        folderPath,
        { recursive: true }
      );

      // ==========================================
      // STEP 3: Upload New Images First
      // ==========================================
      const preparedItems =
        await Promise.all(

          (dto.mortgaged_items ?? []).map(
            async (item: any) => {

              // no file sent
              if (
                item.file_index === undefined ||
                item.file_index === null
              ) {
                return item;
              }

              const file =
                files?.gold_item?.[
                item.file_index
                ];

              if (!file) {
                throw new BadRequestException(
                  `File missing for index ${item.file_index}`
                );
              }

              const fileName =
                await this.saveFile(
                  file,
                  'gold',
                  folderPath
                );

            if (fileName) {
   newUploads.push(fileName);
}
              console.log("newUploads are",newUploads)
              return {
                ...item,
                gold_item: fileName,
              };
            }
          )
        );

      let modified_date: string;

      if (dto.modified_date) {
        const raw = dto.modified_date;
        modified_date = (typeof raw === 'string'
          ? DateTime.fromISO(raw)
          : DateTime.fromJSDate(raw as Date)
        )
          .toUTC()
          .toFormat("yyyy-MM-dd HH:mm:ss");
      } else {
        modified_date = DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss");
      }

      // ==========================================
      // STEP 4: Transaction
      // ==========================================
      await this.db.transaction(
        async (conn) => {

          // ----------------------------------
          // A. Update Loan Master
          // ----------------------------------
          await this.loanRepo.updateLoan(
            loanId,
            { ...dto, modified_date },
            userId,
            conn
          );

          // ----------------------------------
          // B. Sync Nominees
          // ----------------------------------
          await this.syncNominees(
            loanId,
            dto.nominees ?? [],
            conn
          );

          // ----------------------------------
          // C. Sync Mortgaged Items
          // ----------------------------------
          const deletedOldFiles =
            await this.syncMortgageItems(
              loanId,
              preparedItems,
              folderPath,
              conn
            );

          oldFilesToDelete =
            deletedOldFiles;
        }
      );

      // ==========================================
      // STEP 5: Delete Old Files AFTER Commit
      // ==========================================
      console.log("oldFilteToDelete are", oldFilesToDelete)

      for (const p of oldFilesToDelete) {

        const finalPath = path.resolve(p.replace(/^[/\\]+/, ''));

        if (fs.existsSync(finalPath)) {
          await fs.promises.unlink(finalPath)
            .catch(() => { });
        }
      }

      return {
        success: true,
        message:
          'Loan updated successfully',
        loan_id: loanId,
      };

    } catch (error) {

      // delete new uploaded files
      for (const p of newUploads) {

                const finalPathnew = path.resolve(p.replace(/^[/\\]+/, ''));

        if (fs.existsSync(finalPathnew)) {
          await fs.promises.unlink(finalPathnew)
            .catch(() => { });
        }
      }

      throw error;
    }
  }


  async syncNominees(
    loanId: number,
    nominees: any[],
    conn: any,
  ) {

    const dbRows =
      await this.loanRepo
        .getNomineesByLoanId(
          loanId,
          conn
        );

    const dbIds =
      dbRows.map(
        x => x.nominee_id
      );

    const incomingIds =
      nominees
        .filter(
          x => x.nominee_id
        )
        .map(
          x => x.nominee_id
        );

    // ========================
    // DELETE Removed
    // ========================
    const deleteIds =
      dbIds.filter(
        id =>
          !incomingIds.includes(id)
      );

    if (deleteIds.length) {
      await this.loanRepo
        .deleteNomineesBulk(
          deleteIds,
          conn
        );
    }

    // ========================
    // INSERT / UPDATE
    // ========================
    for (const item of nominees) {

      if (item.nominee_id && item.nominee_id != null) {
        await this.loanRepo
          .updateNominee(
            item.nominee_id,
            item,
            conn
          );
      } else {
        await this.loanRepo
          .insertNominee(
            loanId,
            item,
            conn
          );
      }
    }
  }

  async syncMortgageItems(
    loanId: number,
    items: any[],
    folderPath: string,
    conn: any,
  ): Promise<string[]> {

    let oldFiles: string[] = [];

    const dbRows =
      await this.loanRepo
        .getMortgageItemsByLoanId(
          loanId,
          conn
        );

    console.log("dbRows are", dbRows)

    const dbIds =
      dbRows.map(
        x => x.gold_item_id
      );

    console.log("dbIds are", dbIds)

    const incomingIds =
      items
        .filter(
          x => x.gold_item_id
        )
        .map(
          x => x.gold_item_id
        );

    console.log("incoming ids are", incomingIds)
    // ========================
    // DELETE Removed Rows
    // ========================
    const deleteRows =
      dbRows.filter(
        row =>
          !incomingIds.includes(
            row.gold_item_id
          )
      );  

    console.log("deleted Rows are", deleteRows);
    if (deleteRows.length) {

      await this.loanRepo
        .deleteMortgageItemsBulk(
          deleteRows.map(
            x => x.gold_item_id
          ),
          conn
        );

      oldFiles.push(
        ...deleteRows.map(
          x => (x.gold_item)
        )
      );

    }


    for (const item of items) {

      // UPDATE
      if (item.gold_item_id && item.gold_item_id != null) {

        const old =
          dbRows.find(
            x =>
              x.gold_item_id ===
              item.gold_item_id
          );

        if (
          item.gold_item &&
          old &&
          old.gold_item &&
          old.gold_item !==
          item.gold_item
        ) {
          console.log("inside old")
          oldFiles.push(

            old.gold_item

          );

        }

        await this.loanRepo
          .updateMortgageItem(
            item.gold_item_id,
            item,
            conn
          );
      }

      // INSERT
      else {
        await this.loanRepo
          .insertMortgageItem(
            loanId,
            item,
            conn
          );
      }
    }

    console.log("oldFiles to delete are", oldFiles)

    return oldFiles;
  }



  async saveFile(
    file: Express.Multer.File,
    prefix: string,
    folder: string
  ): Promise<string | null> {

    if (!file) return null;

    const ext = path.extname(
      file.originalname
    );

    // original name without extension
    const baseName = path
      .basename(file.originalname, ext)
      .trim();

    // sanitize filename
    const safeName = baseName
      .replace(/\s+/g, '_')        // spaces -> _
      .replace(/[^a-zA-Z0-9_-]/g, ''); // remove special chars


    const fileName =
      `${prefix}_${safeName}_${uuidv4()}${ext}`;

    const fullPath =
      path.join(folder, fileName);

    await fs.promises.writeFile(
      fullPath,
      file.buffer
    );

    return '/' + fullPath.replace(/\\/g, '/');
  }



  async getLoanList(
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
        const schema = LOAN_FILTER_SCHEMA[f.field];

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
          ? await this.loanRepo.getFilteredCount(validatedFilters, userid)
          : await this.loanRepo.getTotalCount(userid);

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.loanRepo.findWithFilters(validatedFilters, page, limit, userid)
          : await this.loanRepo.findAll(page, limit, userid);

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

      console.error("getBeneficiarylist error", error)
      throw new InternalServerErrorException("Failed to fetch Loan list");

    }
  }



  async getLoanById(loanId: number) {

    try {

      if (!loanId) {
        throw new BadRequestException("loan id is missing");
      }

      const data = await this.loanRepo.getLoanFullDetails(loanId);

      return {
        message: "data fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("get loan by id error is", error)
    }
  }


}