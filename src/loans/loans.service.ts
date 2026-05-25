/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from 'src/database/database.service';
import { v4 as uuidv4 } from 'uuid';
import { LoanRepository } from './loan.repository/loan.repository';
import { TransactionRepository } from 'src/transactions/transaction.repository/transaction.repository';
import { LedureRepository } from 'src/ledure/ledure.repository/ledure.repository';
import * as Sentry from '@sentry/node';
import { LOAN_FILTER_SCHEMA } from './loan.filter.schema';
import { randomBytes } from "crypto";
import { DateTime } from 'luxon';
import { filter } from 'rxjs';

@Injectable()
export class LoansService {
  constructor(
    private readonly db: DatabaseService,
    private readonly loanRepo: LoanRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly ledureRepo: LedureRepository,
  ) { }


  async searchLoansmobile(
    search: string,
    page: number,
    limit: number,
    companyId: number,
  ) {

    if (!search?.trim()) {
      throw new BadRequestException('Search is required');
    }

    return this.loanRepo.searchLoansmob(
      search.trim(),
      page,
      limit,
      companyId,
    );
  }

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
      console.error("Search loans error", error)

      throw new InternalServerErrorException("Failed to get updated data",);
    }

  }

  async getClientLoanSummary(clientId: number, companyId: number, page: number = 1, limit: number = 10, filters: any[] = []) {

    try {

      const loans = await this.transactionRepo.getClientLoanSummary(clientId, companyId);

      const validLoans = (loans || []).filter(
        (loan: any) => loan.loan_id !== null
      );

      const loanRows = validLoans.map((loan: any) => {
        const totalAmount = Number(loan.total_amount ?? 0);
        const principalAmount = Number(loan.principal_amount ?? 0);
        const interestAmount = Number(loan.interest_amount ?? 0);
        const interestRate = Number(loan.interest_rate ?? 0);
        const totalPaidAmount = Number(loan.total_paid_amount ?? 0);
        const totalPaidPrincipal = Number(loan.total_paid_principal ?? 0);
        const totalPaidInterest = Number(loan.total_paid_interest ?? 0);
        const pendingAmount = Number(
          loan.current_total_balance ?? (totalAmount - totalPaidAmount)
        );

        const pendingPrincipal = Number(
          loan.current_principal_balance ?? (principalAmount - totalPaidPrincipal)
        );

        // const pendingInterest = Number(
        //  loan.current_interest_balance ?? (interestAmount - totalPaidInterest)
        // );

        const pendingInterest =
          loan.loan_status === 'close'
            ? 0
            : Number(
              loan.current_interest_balance ??
              (interestAmount - totalPaidInterest)
            );

        const pendinginterestdaily = Number(loan.accrued_interest ?? 0);

        return {
          loan_id: loan.loan_id,
          loan_status: loan.loan_status,
          loan_document_number: loan.loan_document_number,
          loan_start_date: loan.loan_start_date,
          tenure: loan.tenure,
          principal_amount: principalAmount,
          interest_amount: interestAmount,
          daily_interest_amount: Math.round(loan.accrued_interest ?? 0),
          topup_amount: Number(loan.total_topup_amount ?? 0),
          total_amount: totalAmount,
          interest_rate: interestRate,
          total_paid_amount: totalPaidAmount,
          total_paid_principal: totalPaidPrincipal,
          total_paid_interest: totalPaidInterest,
          total_pending_amount: Math.round(Math.max(0, pendingAmount)),
          total_pending_principal: Math.max(0, pendingPrincipal),
          total_pending_interest: Math.max(0, pendingInterest),
          last_payment_date: loan.last_payment_date || null,
        };
      });

      const totals = loanRows.reduce(
        (acc, loan) => {
          acc.total_loan_amount += loan.total_amount;
          acc.total_principal += loan.principal_amount;
          acc.total_interest_amount += loan.interest_amount;
          acc.total_daily_pending_interest += Number(loan.daily_interest_amount || 0);
          acc.total_interest_rate += loan.interest_rate;
          acc.total_paid_amount += loan.total_paid_amount;
          acc.total_paid_principal += loan.total_paid_principal;
          acc.total_paid_interest += loan.total_paid_interest;
          acc.total_pending_amount += loan.total_pending_amount;
          acc.total_pending_principal += loan.total_pending_principal;
          acc.total_pending_interest += loan.total_pending_interest;
          return acc;
        },
        {
          total_loan_amount: 0,
          total_principal: 0,
          total_interest_amount: 0,
          total_interest_rate: 0,
          total_paid_amount: 0,
          total_paid_principal: 0,
          total_paid_interest: 0,
          total_pending_amount: 0,
          total_pending_principal: 0,
          total_pending_interest: 0,
          total_daily_pending_interest: 0,
        },
      );

      const clientTotalTopupAmount =
        loans.length > 0
          ? Number(loans[0].client_total_topup_amount ?? 0)
          : 0;

      // Get total count for pagination
      const totalLedureRecords = await this.ledureRepo.getLedgerCountByClientId(clientId, companyId, filters);
      const totalPages = Math.ceil(totalLedureRecords / limit);
      const start = totalLedureRecords === 0 ? 0 : (page - 1) * limit + 1;
      const end = Math.min(page * limit, totalLedureRecords);


      const ledureRows = await this.ledureRepo.getLedgerByClientId(clientId, companyId, page, limit, filters);

      const client = loans.length > 0 ? {
        client_code: loans[0].client_code,
        caste: loans[0].caste,
        occupation: loans[0].occupation,
        mobile_no: loans[0].mobile_no,
        email: loans[0].email,
        dob: loans[0].dob,
        gender: loans[0].gender,
        status: loans[0].status,
        created_date: loans[0].created_date,
        created_by: loans[0].created_by,
        first_name: loans[0].first_name,
        last_name: loans[0].last_name,
        street_add1: loans[0].street_add1,
        street_add2: loans[0].street_add2
      } : null;

      return {
        success: true,
        message: loanRows.length ? 'Client loan summary fetched successfully' : 'No loans found for this client',
        client_id: clientId,
        client,
        loan_count: loanRows.length,
        // totals: {
        //   ...totals,
        //   client_total_topup_amount: clientTotalTopupAmount,

        //   average_interest_rate:
        //     loanRows.length > 0
        //       ? Number((totals.total_interest_rate / loanRows.length).toFixed(2))
        //       : 0,
        // },

        totals: {
          total_loan_amount: Math.round(totals.total_loan_amount),
          total_principal: Math.round(totals.total_principal),
          total_interest_amount: Math.round(totals.total_interest_amount),
          total_interest_rate: Math.round(totals.total_interest_rate),
          total_paid_amount: Math.round(totals.total_paid_amount),
          total_paid_principal: Math.round(totals.total_paid_principal),
          total_paid_interest: Math.round(totals.total_paid_interest),
          total_pending_amount: Math.round(totals.total_pending_amount),
          total_pending_principal: Math.round(totals.total_pending_principal),
          total_pending_interest: Math.round(totals.total_pending_interest),
          total_daily_pending_interest: Math.round(totals.total_daily_pending_interest),

          client_total_topup_amount: Math.round(clientTotalTopupAmount),

          average_interest_rate:
            loanRows.length > 0
              ? Math.round(totals.total_interest_rate / loanRows.length)
              : 0,
        },
        loans: loanRows,
        ledure: {
          currentPage: page,
          limit,
          start,
          end,
          totalRecords: totalLedureRecords,
          totalPages,
          nextPage: page < totalPages ? page + 1 : null,
          previousPage: page > 1 ? page - 1 : null,
          data: ledureRows
        },
      };
    } catch (error) {
      Sentry.captureException(error);

      console.error('getClientLoanSummary error', error);
      throw new InternalServerErrorException('Failed to fetch client loan summary');
    }
  }

  async getMortgageItemsByLoanId(loanId: number) {

    try {

      const items = await this.loanRepo.getMortgage(loanId);


      if (!items?.length) {
        return {
          success: true,
          message: 'No mortgaged items found for this loan',
          loan_id: loanId,
          mortgaged_items: [],
        };
      }

      const firstItem = items[0];

      return {
        success: true,
        message: 'Mortgaged items fetched successfully',

        loan: {
          loan_id: firstItem.loan_id,
          loan_no: firstItem.loan_no,
          principal_amount: firstItem.principal_amount,
          interest_rate: firstItem.interest_rate,
          due_date: firstItem.due_date,
          financial_year: firstItem.financial_year,
          loan_start_date: firstItem.loan_start_date,
          transaction_date: firstItem.transaction_date,
          by_hand: firstItem.created_by_name,
          total_mortgaged_amount: firstItem.total_mortgaged_amount, // <- here
        },

        client: {
          borrower: firstItem.borrower,
          caste: firstItem.caste,
          client_code: firstItem.client_code,
          mobile_no: firstItem.mobile_no,
          street_add1: firstItem.street_add1,
          city: firstItem.city,
          profile_photo: firstItem.profile_pic_path,
        },

        company: {
          company_name: firstItem.company_name,
          license_number: firstItem.license_number,
          note: firstItem.note,
          company_logo: firstItem.company_logo,
          address: firstItem.address,
        },




        mortgaged_items: items.map((item) => ({
          mortgaged_id: item.gold_item_id,
          gold_item: item.gold_item,
          category: item.category,
          total_weight: item.total_weight,
          gross_weight: item.gross_weight,
          net_weight: item.net_weight,
          note: item.morgaged_note,
          amount: item.amount,
        })),
      };
    } catch (error) {
      Sentry.captureException(error);

      console.error('getMortgageItemsByLoanId error', error);
      throw new InternalServerErrorException(
        'Failed to fetch mortgaged items',
      );
    }
  }

  async getLoanRecpt(loanId: number) {
    try {
      const items = await this.loanRepo.getLoanById(loanId);


      return {
        success: true,
        message: 'loan fetched successfully',
        loan_id: loanId,
        loan: items,
      };
    } catch (error) {
      Sentry.captureException(error);

      console.error('getMortgageItemsByLoanId error', error);
      throw new InternalServerErrorException('Failed to fetch mortgaged items');
    }
  }

  private generateClientCode(): string {
    const year = new Date().getFullYear();
    const randomPart = randomBytes(3).toString("hex").toUpperCase(); // 6 chars

    return `GL-${year}-${randomPart}`;
  }


  private async saveClientFile(
    file: Express.Multer.File | undefined,
    cid: number,
    prefix: string,
    folderPath: string
  ): Promise<{ dbPath: string | null; filePath: string | null }> {

    if (!file) {
      return { dbPath: null, filePath: null };
    }

    let allowedTypes = [".jpg", ".jpeg", ".png", ".pdf"];

    if (prefix === "photo") {
      allowedTypes = [".jpg", ".jpeg", ".png"];
    }
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException("Invalid file type");
    }


    const fileName = `${prefix}_${cid}_${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(folderPath, fileName);
    const dbPath = `/${folderPath}/${fileName}`;

    await fs.promises.writeFile(filePath, file.buffer);

    return { dbPath, filePath };
  }


  private async replaceClientFile(
    file: Express.Multer.File | undefined,
    cid: number,
    prefix: string,
    folderPath: string,
    oldFilePath?: string,
    removeFile?: boolean
  ): Promise<{ dbPath?: string | null; filePath?: string | null; oldFileToDelete?: string | null }> {
    //                                                            ↑ return old path instead of deleting immediately

    // CASE 1: user removed image
    if (removeFile) {
      return {
        dbPath: null,
        filePath: null,
        oldFileToDelete: oldFilePath ?? null  // ✅ just return it, don't delete yet
      };
    }

    // CASE 2: new upload
    if (file) {
      const fileName = `${prefix}_${cid}_${uuidv4()}${path.extname(file.originalname)}`;
      const filePath = path.join(folderPath, fileName);
      const dbPath = `/${folderPath}/${fileName}`;

      await fs.promises.writeFile(filePath, file.buffer);  // write new file

      return {
        dbPath,
        filePath,
        oldFileToDelete: oldFilePath ?? null  // ✅ return old path, delete after DB succeeds
      };
    }

    // CASE 3: untouched
    return {};
  }


  private async generateBackdatedInterest(
    loanId: number | null,
    principal: number,
    annualRate: number,
    startDate: string,
    conn: any,
  ) {

    const start = DateTime
      .fromISO(startDate, {
        zone: 'Asia/Kolkata'
      })
      .startOf('day');

    const today = DateTime
      .now()
      .setZone('Asia/Kolkata')
      .startOf('day');

    // no backdated entries needed
    if (start.toMillis() > today.toMillis()) {

      return {
        accruedInterest: 0
      };
    }

    const dailyInterest = Number(
      (
        (principal * annualRate)
        / 365
        / 100
      ).toFixed(2)
    );

    let runningAccrued = 0;

    let current = start;

    while (current.toMillis() <= today.toMillis()) {

      runningAccrued = Number(
        (
          runningAccrued + dailyInterest
        ).toFixed(2)
      );

      await this.loanRepo.insertDailyInterest(
        {
          loan_id: loanId,

          interest_date:
            current.toISODate(),

          daily_interest:
            dailyInterest,

          accrued_interest:
            runningAccrued,
        },
        conn
      );

      current = current.plus({ days: 1 });
    }

    return {
      accruedInterest: runningAccrued
    };
  }


  async createLoan(dto: any, files: any, transactionRecpt: Express.Multer.File | undefined, userId: number, companyIdNum: number) {

    let uploadedPaths: string[] = [];
    let loanId: number | null = null;

    try 
    {

      const isDraft = dto.loan_status === 'draft';

      console.log("is draft is", isDraft);
      const clientData = await this.loanRepo.getClientstatus(dto.client_id);

      const nowIST = DateTime.now().setZone('Asia/Kolkata');

      if (!clientData) {
        throw new NotFoundException("Client not found");
      }

      if (clientData.status?.toLowerCase() === "inactive") {
        throw new BadRequestException(
          "Loan cannot be created for inactive client"
        );
      }

      console.log("loan document number is", dto.loan_document_number);
      dto.compl_id = companyIdNum;
      // STEP 1: Insert loan first

      const principal = Number(dto.principal_amount);
      const annualRate = Number(dto.interest_rate);

      const dailyInterest = Number(
        ((principal * annualRate) / (365 * 100)).toFixed(2)
      );

      dto.principal_balance =
        Number(dto.principal_amount);

      dto.accrued_interest = 0
      // Number(dailyInterest);

      dto.total_amount =
        Number(dto.principal_amount);

      const todayObj = DateTime.now()
        .setZone('Asia/Kolkata')
        .startOf('day');

      const todaySql = todayObj.toFormat('yyyy-MM-dd');

      if (!isDraft) {

        const dueDate = DateTime
          .fromISO(dto.due_date)
          .setZone('Asia/Kolkata')
          .startOf('day');

        dto.loan_status =
          dueDate.toMillis()
            < todayObj.toMillis()
            ? 'overdue'
            : 'active';

      }

      const loanRes = await this.loanRepo.insertLoan(dto, userId);
      console.log("loan id in loanRes is", loanRes)

      loanId = loanRes.insertId;

      if (loanId === null) {

        throw new Error('Loan ID not generated');

      }

      // ✅ STEP 3: Create folder using cid
      const folderPath1 = `uploads/loan/${loanId}`;
      await fs.promises.mkdir(folderPath1, { recursive: true });

      if (!isDraft) {

        console.log("inside loan is not draft");
        const loan_no = await this.loanRepo.generateNumber(companyIdNum, "LOAN")
        dto.loan_document_number = loan_no;


      }

      // ✅ STEP 4: Save files
      const [transactionImg] = await Promise.all([
        this.saveClientFile(transactionRecpt, loanId, "transaction", folderPath1),
      ]);

      if (transactionImg?.filePath) {
        uploadedPaths.push(transactionImg.filePath);
      }

      // ✅ STEP 5: Update DB with file paths

      const updateResult = await this.loanRepo.updateFilesPath(loanId, {
        payment_proof_file: transactionImg.dbPath
      });

      if (!updateResult || updateResult.affectedRows !== 1) {
        throw new Error("Client file update failed");
      }

      const finalLoanId = loanId;
      // STEP 2: Folder path
      const folderPath = `uploads/gold/${userId}/${dto.client_id}/${loanId}`;

      await fs.promises.mkdir(folderPath, { recursive: true });

      // STEP 3: Upload files
    const mortgageItems = await Promise.all(
  (dto.mortgaged_items ?? []).map(async (item: any) => {

    const hasFileIndex =
      item.file_index !== undefined &&
      item.file_index !== null &&
      item.file_index !== '';

    // no image uploaded
    if (!hasFileIndex) {

      return {
        ...item,
        gold_item: null
      };

    }

    const file =
      files?.gold_item?.[item.file_index];

    if (!file) {
      throw new BadRequestException(
        `File missing for index ${item.file_index}`
      );
    }

    const imgPath = await this.saveFile(
      file,
      'gold',
      folderPath
    );

    if (imgPath) {
      uploadedPaths.push(imgPath);
    }

    return {
      ...item,
      gold_item: imgPath
    };
  })
);

      const folderPathtransaction = `uploads/transaction/${dto.client_id}/${loanId}`;

      await fs.promises.mkdir(folderPathtransaction, { recursive: true });

      const disbursementPayments = await Promise.all(


        (dto.payments ?? []).map(async (item, index) => {

          
    const hasFileIndex =
      item.file_index !== undefined &&
      item.file_index !== null &&
      item.file_index !== '';

    // no image uploaded
    if (!hasFileIndex) {

      return {
        ...item,
        payment_proof_file: null
      };

    }


          const file = files?.payment_proof_file?.[index];

          // if (!file) {
          //   throw new BadRequestException(
          //     `Gold image required for item ${index + 1}`
          //   );
          // }

          const imgPath = await this.saveFile(
            file,
            'transaction',
            folderPathtransaction
          );

          console.log("img path is ", imgPath)

          if (imgPath) {
            uploadedPaths.push(imgPath);
          }


          return {
            ...item,
            payment_proof_file: imgPath
          };
        })

      );

      // STEP 4: Transaction only for child tables
      await this.db.transaction(async (conn) => {

        const validNominees = dto.nominees?.filter((nominee) => {
          return (
            nominee.nominee_name?.trim() ||
            nominee.nominee_relation?.trim() ||
            nominee.nominee_address?.trim() ||
            nominee.nominee_phone?.trim()
          );
        });

        if (validNominees?.length) {

          await this.loanRepo.insertNomineesBulk(
            finalLoanId,
            validNominees,
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

        if (disbursementPayments?.length) {

          await this.loanRepo
            .insertLoanDisbursementsBulk(
              finalLoanId,
              companyIdNum,
              disbursementPayments,
              conn
            );
        }

        if (!isDraft) {

          const result =
            await this.generateBackdatedInterest(
              loanId,
              Number(dto.principal_amount),
              Number(dto.interest_rate),
              dto.loan_start_date,
              conn
            );

          await this.loanRepo.updateLoanInterest(
            loanId,
            {
              accrued_interest:
                result.accruedInterest,

              total_amount:
                Number(dto.principal_amount)
                + Number(result.accruedInterest),

              last_interest_date: todaySql,
              loan_document_number: dto.loan_document_number,
            },
            conn
          );


        }

        if (
          !isDraft &&
          (
            dto.loan_status === 'active' ||
            dto.loan_status === 'overdue'
          )
        ) {

          // Generate Receipt Number
          // const receiptNo =
          //   await this.loanRepo.generateNumber(
          //     companyIdNum,
          //     "TRANSACTION"
          //   );

          // -------------------------------------
          // Insert loan_transactions row
          // -------------------------------------
          // const txRes =
          //   await this.loanRepo.insertLoanTransaction(
          //     {
          //       receipt_no: receiptNo,
          //       loan_id: loanId,
          //       client_id: dto.client_id,
          //       company_id: companyIdNum,
          //       transaction_date: new Date(),
          //       transaction_type: "DISBURSEMENT",
          //       payment_method: dto.payment_type,
          //       paid_amount: 0,
          //       principal_paid: 0,
          //       interest_paid: 0,
          //       overdue_paid: 0,
          //       topup_amount: 0,
          //       principal_balance: dto.principal_amount,
          //       interest_balance: dto.interest_amount,
          //       overdue_balance: dto.overdue_amount||0,
          //       total_balance: dto.total_amount,
          //       remarks: "Loan Disbursed",
          //       cheque_no: dto.cheque_no || null,
          //       account_type: dto.account_type,
          //       transaction_ref_no:
          //         dto.transaction_ref_no || null,
          //       status: "SUCCESS",
          //       created_by: userId,
          //       payment_proof_path:
          //         transactionImg?.dbPath || null,
          //     },
          //     userId,
          //     conn
          //   );

          // const transactionId = txRes.insertId;

          const istNow = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd HH:mm:ss');

          let totalDisbursed = 0;
          let latestTransactionDate: string | null = null;


          for (const payment of disbursementPayments) {

            const transactionDateTime = DateTime
              .fromISO(dto.transaction_date, {
                zone: 'Asia/Kolkata'
              })
              .set({
                hour: nowIST.hour,
                minute: nowIST.minute,
                second: nowIST.second,
                millisecond: 0,
              })
              .toFormat('yyyy-MM-dd HH:mm:ss');

            latestTransactionDate = transactionDateTime;


            const accountId =
              Number(payment.account_id);

            const paidAmount =
              Number(payment.amount || 0);

            totalDisbursed += paidAmount;

            const accountBalance: any =
              await this.loanRepo.getLatestAccountBalance(
                accountId,
                conn
              );

            if (paidAmount > accountBalance) {

              throw new BadRequestException(
                `Insufficient balance in account ${accountId}.
       Available balance ₹${accountBalance}`
              );
            }

            const accountBalanceAfter =
              accountBalance - paidAmount;

            // ACCOUNT LEDGER ENTRY
            await this.loanRepo.insertLedger(
              {
                loan_id: loanId,
                client_id: dto.client_id,
                company_id: companyIdNum,
                account_id: accountId,
                credit: 0,
                debit: paidAmount,
                entry_type:
                  "Disbursement Amount Paid",
                remarks:
                  "Paid from selected account",
                balance_after:
                  accountBalanceAfter,
                status: "debit",
                type: "account",
                entry_date: istNow,
                transaction_date:
                  transactionDateTime,
              },
              conn
            );
          }


          const loanBalance: any =
            await this.loanRepo.getLatestLoanBalance(
              loanId,
              conn
            );

          const loanBalanceAfter =
            loanBalance + totalDisbursed;

          await this.loanRepo.insertLedger(
            {
              loan_id: loanId,
              client_id: dto.client_id,
              company_id: companyIdNum,
              credit: totalDisbursed,
              debit: 0,
              balance_after:
                loanBalanceAfter,
              entry_type:
                "Disbursement Amount Paid",
              remarks:
                "Loan given to customer",
              status: "credit",
              type: "loan",
              entry_date: istNow,
              transaction_date:
                latestTransactionDate,
            },
            conn
          );

        }

      });

      return {
        success: true,
        message: isDraft
          ? "Loan draft saved successfully"
          : "Loan created successfully",
        loan_id: loanId
      };


    }

    catch (error) {

      Sentry.captureException(error);

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
    transactionfile: Express.Multer.File | undefined,
    userId: number,
    companyIdNum: number,

  ) {

    let newUploads: string[] = [];
    let oldFilesToDelete: string[] = [];

    const nowIST = DateTime.now().setZone('Asia/Kolkata');


    try {

      dto.loan_status =
        dto.loan_status || 'draft';

      const isDraft = dto.loan_status === 'draft';

      const isFinalSave =
        dto.loan_status === 'active';
      // ==========================================
      // STEP 1: Validate Loan Exists
      // ==========================================
      const loan =
        await this.loanRepo.getLoanById(
          loanId
        );

      // ==========================================
      // STEP 2: Folder Path
      // ==========================================

      const folderPath1 = `uploads/loan/${loanId}`;
      await fs.promises.mkdir(folderPath1, { recursive: true });

      const transaction_photo = await this.replaceClientFile(transactionfile, loanId, "transaction", folderPath1, loan.transaction_path, dto.remove_adhar)

      if (transaction_photo.filePath) {
        newUploads.push(transaction_photo.filePath);
      }

      if (transaction_photo.oldFileToDelete) {
        oldFilesToDelete.push(transaction_photo.oldFileToDelete);
      }

      const fileUpdates: any = {};

      if (transaction_photo.dbPath !== undefined) {
        fileUpdates.payment_proof_file = transaction_photo.dbPath;
      }

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

              const removeGoldItem =
                item.remove_gold_item === true ||
                item.remove_gold_item === 'true';

              // CASE 1:
              // user removed image only

              if (
                removeGoldItem &&
                (
                  item.file_index ===
                  undefined ||
                  item.file_index === null
                )
              ) {
                return {
                  ...item,
                  gold_item: null,
                };
              }

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
              console.log("newUploads are", newUploads)
              return {
                ...item,
                gold_item: fileName,
              };

            }
          )

        );

      const folderPath3 =
        `uploads/transaction/${loan.client_id}/${loanId}`;

      await fs.promises.mkdir(
        folderPath3,
        { recursive: true }
      );

      const preparedPayments =
        await Promise.all(

          (dto.payments ?? []).map(
            async (item: any) => {

              const removeProof =
                item.remove_payment_proof === true ||
                item.remove_payment_proof === 'true';

              const hasFileIndex =
                item.proof_file_index !== undefined &&
                item.proof_file_index !== null &&
                item.proof_file_index !== '';

              // remove existing proof
              
              if (removeProof && !hasFileIndex) {
                return {
                  ...item,
                  payment_proof_file: null,
                };
              }

              // no new file uploaded -> preserve old file
              if (!hasFileIndex) {
                return item;
              }


              const file =
                files?.payment_proof_file?.[
                item.proof_file_index
                ];

              if (!file) {
                return item;
              }


              const uploaded =
                await this.saveClientFile(
                  file,
                  loanId,
                  'transaction',
                  folderPath3
                );

              if (uploaded?.filePath) {
                newUploads.push(
                  uploaded.filePath
                );
              }

              return {
                ...item,
                payment_proof_file:
                  uploaded?.dbPath || null,
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

      const todayObj = DateTime.now()
        .setZone('Asia/Kolkata')
        .startOf('day');

      const todaySql =
        todayObj.toFormat('yyyy-MM-dd');

      if (!isDraft) {

        const loan_no = await this.loanRepo.generateNumber(companyIdNum, "LOAN")
        dto.loan_document_number = loan_no;


        const dueDate = DateTime
          .fromISO(dto.due_date)
          .setZone('Asia/Kolkata')
          .startOf('day');

        dto.loan_status =
          dueDate.toMillis()
            < todayObj.toMillis()
            ? 'overdue'
            : 'active';

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
            fileUpdates,
            userId,
            conn
          );

          // ----------------------------------
          // B. Sync Nominees
          // ----------------------------------

          const validNominees = (dto.nominees ?? []).filter((nominee) => {
            return (
              nominee.nominee_name?.trim() ||
              nominee.nominee_relation?.trim() ||
              nominee.nominee_address?.trim() ||
              nominee.nominee_phone?.trim()
            );
          });

          await this.syncNominees(
            loanId,
            validNominees,
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


          oldFilesToDelete.push(
            ...deletedOldFiles
          );

          const deletedPaymentFiles =
            await this.syncPaymentInfo(
              loanId,
              companyIdNum,
              preparedPayments,
              conn
            );

          oldFilesToDelete.push(
            ...deletedPaymentFiles
          );



          if (isFinalSave) {

            // interest generation
            const result =
              await this.generateBackdatedInterest(
                loanId,
                Number(dto.principal_amount),
                Number(dto.interest_rate),
                dto.loan_start_date,
                conn
              );

            await this.loanRepo.updateLoanInterest(
              loanId,
              {
                accrued_interest:
                  result.accruedInterest,

                total_amount:
                  Number(dto.principal_amount)
                  + Number(result.accruedInterest),

                last_interest_date:
                  todaySql,

                loan_status:
                  dto.loan_status,

                loan_document_number: dto.loan_document_number
              },
              conn
            );

            // -------------------------
            // Ledger logic
            // -------------------------
            const istNow = DateTime.now()
              .setZone('Asia/Kolkata')
              .toFormat(
                'yyyy-MM-dd HH:mm:ss'
              );


            let totalDisbursed = 0;
            let latestTransactionDate: string | null = null;


            for (const payment of preparedPayments) {

              const transactionDateTime = DateTime
                .fromISO(dto.transaction_date, {
                  zone: 'Asia/Kolkata'
                })
                .set({
                  hour: nowIST.hour,
                  minute: nowIST.minute,
                  second: nowIST.second,
                  millisecond: 0,
                })
                .toFormat('yyyy-MM-dd HH:mm:ss');

              latestTransactionDate = transactionDateTime;


              const accountId =
                Number(payment.account_id);

              const paidAmount =
                Number(payment.amount || 0);

              totalDisbursed += paidAmount;

              const accountBalance: any =
                await this.loanRepo.getLatestAccountBalance(
                  accountId,
                  conn
                );

              if (paidAmount > accountBalance) {

                throw new BadRequestException(
                  `Insufficient balance in account ${accountId}.
       Available balance ₹${accountBalance}`
                );
              }

              const accountBalanceAfter =
                accountBalance - paidAmount;

              // ACCOUNT LEDGER ENTRY
              await this.loanRepo.insertLedger(
                {
                  loan_id: loanId,
                  client_id: dto.client_id,
                  company_id: companyIdNum,
                  account_id: accountId,
                  credit: 0,
                  debit: paidAmount,
                  entry_type:
                    "Disbursement Amount Paid",
                  remarks:
                    "Paid from selected account",
                  balance_after:
                    accountBalanceAfter,
                  status: "debit",
                  type: "account",
                  entry_date: istNow,
                  transaction_date:
                    transactionDateTime,
                },
                conn
              );
            }


            const loanBalance: any =
              await this.loanRepo.getLatestLoanBalance(
                loanId,
                conn
              );

            const loanBalanceAfter =
              loanBalance + totalDisbursed;

            await this.loanRepo.insertLedger(
              {
                loan_id: loanId,
                client_id: dto.client_id,
                company_id: companyIdNum,
                credit: totalDisbursed,
                debit: 0,
                balance_after:
                  loanBalanceAfter,
                entry_type:
                  "Disbursement Amount Paid",
                remarks:
                  "Loan given to customer",
                status: "credit",
                type: "loan",
                entry_date: istNow,
                transaction_date:
                  latestTransactionDate,
              },
              conn
            );
          }
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
              message: isFinalSave
          ? "Loan  Updated successfully"
          : "Loan Draft Updated successfully",
        loan_id: loanId,
      };

    } catch (error) {

      Sentry.captureException(error);

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


  async syncPaymentInfo(
    loanId: number,
    companyId: number,
    payments: any[],
    conn: any,
  ): Promise<string[]> {

    let oldFiles: string[] = [];

    const dbRows =
      await this.loanRepo
        .getPaymentInfoByLoanId(
          loanId,
          conn
        );

    console.log(
      "payment dbRows are",
      dbRows
    );

    const dbIds =
      dbRows.map(
        x => x.id
      );

    console.log(
      "payment dbIds are",
      dbIds
    );

    const incomingIds =
      payments
        .filter(
          x => x.id
        )
        .map(
          x => x.id
        );

    console.log(
      "incoming payment ids are",
      incomingIds
    );

    // ========================
    // DELETE Removed Rows
    // ========================
    const deleteRows =
      dbRows.filter(
        row =>
          !incomingIds.includes(
            row.id
          )
      );

    console.log(
      "deleted payment rows are",
      deleteRows
    );

    if (deleteRows.length) {

      await this.loanRepo
        .deletePaymentInfoBulk(
          deleteRows.map(
            x => x.id
          ),
          conn
        );

      oldFiles.push(
        ...deleteRows
          .map(
            x => x.payment_proof_file
          )
          .filter(Boolean)
      );
    }

    // ========================
    // UPDATE / INSERT
    // ========================
    for (const payment of payments) {

      // UPDATE
      if (
        payment.id &&
        payment.id != null
      ) {

        const old =
          dbRows.find(
            x =>
              x.id ===
              payment.id
          );

        if (
          old?.payment_proof_file
        ) {

          // replaced file
          if (
            payment.payment_proof_file &&
            old.payment_proof_file !==
            payment.payment_proof_file
          ) {

            oldFiles.push(
              old.payment_proof_file
            );

          }

          // removed file
          if (
            payment.payment_proof_file ===
            null
          ) 
          {

            oldFiles.push(
              old.payment_proof_file
            );
          }

        }

        await this.loanRepo
          .updatePaymentInfo(
            payment.id,
            payment,
            conn
          );

      }

      // INSERT
      else {

        await this.loanRepo
          .insertPaymentInfo(
            loanId,
            companyId,
            payment,
            conn
          );
      }
    }

    console.log(
      "payment oldFiles are",
      oldFiles
    );

    return oldFiles;
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
    if (deleteRows.length)
       {

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

        // if (
        //   item.gold_item &&
        //   old &&
        //   old.gold_item &&
        //   old.gold_item !==
        //   item.gold_item
        // ) {
        //   console.log("inside old")
        //   oldFiles.push(

        //     old.gold_item

        //   );

        // }

        if (old?.gold_item) {

          // replaced image
          if (
            item.gold_item &&
            old.gold_item !== item.gold_item
          ) {
            oldFiles.push(
              old.gold_item
            );
          }

          // removed image
          if (item.gold_item === null) {
            oldFiles.push(
              old.gold_item
            );
          }
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
        message: "loan fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("get loan by id error is", error)
    }
  }


  async getAllLoan(userid: number) {

    try {

      const data = await this.loanRepo.getallloans(userid);

      return {
        message: "loans fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("get loans error is", error)
    }
  }


  async getAllAccount() {

    try {

      const data = await this.loanRepo.getallbanks();

      return {
        message: "bank accounts fetched succesfully"
        , data
      }
    }
    catch (error) {
      console.error("get account error is", error)
    }
  }

}