/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { TRANSACTION_FILTER_SCHEMA } from './transaction.filter.schema';
import { TransactionRepository } from './transaction.repository/transaction.repository';
import { DatabaseService } from 'src/database/database.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import * as Sentry from '@sentry/node';

@Injectable()
export class TransactionsService {


  constructor(private readonly transactionrepo: TransactionRepository, private readonly db: DatabaseService,
  ) {

  }


  async searchTransactionsmobile(
    search: string,
    page: number,
    limit: number,
    companyId: number,
  ) {

    try {
      if (!search?.trim()) {
        throw new BadRequestException('Search is required');
      }

      return this.transactionrepo.searchTransactions(
        search.trim(),
        page,
        limit,
        companyId,
      );
    }
    catch (error) {
      Sentry.captureException(error);

    }
  }

  private generateReciptCode(): string {
    const randomPart = randomBytes(3).toString("hex").toUpperCase(); // 6 chars

    return `REC-${randomPart}`;
  }

  async getTransactionList(
    page: number,
    limit: number,
    filters: any[] = [],
    companyIdNum: number
  ) {
    
    try {

      if (page < 1) page = 1;
      if (limit < 1) limit = 10;

      if (!companyIdNum || companyIdNum <= 0) {
        throw new Error("Company ID is required and must be a valid positive number");
      }
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
          valueTo: f.valueTo

        };
      });


      const totalRecords =
        validatedFilters.length > 0
          ? await this.transactionrepo.getFilteredCount(validatedFilters, companyIdNum)
          : await this.transactionrepo.getTotalCount(companyIdNum);

      const totalPages = Math.ceil(totalRecords / limit);

      const data =
        validatedFilters.length > 0
          ? await this.transactionrepo.findWithFilters(validatedFilters, page, limit, companyIdNum)
          : await this.transactionrepo.findAll(page, limit, companyIdNum);

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

      if (error.message === "Company ID is required and must be a valid positive number") {
        console.error("Company ID validation failed:", error);
        throw new BadRequestException(error.message); // Or appropriate HTTP exception
      }

      console.error("getTransaction error", error)

      throw new InternalServerErrorException("Failed to fetch transaction list");

    }
  }

  async createTransaction(
    dto: any,
    paymentProofFile: Express.Multer.File | undefined,
    userId: number,
    companyId: number,
  ) {
    let folderPath: string | null = null;
    let transactionId: number | null = null;

    try {
      dto.company_id = companyId;

      const nowIST = DateTime.now()
        .setZone('Asia/Kolkata');

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

      // =====================================
      // STEP 1 FETCH LOAN
      // =====================================

      const loan = await this.transactionrepo.getLoanById(dto.loan_id);

      if (!loan) {
        throw new BadRequestException('Loan not found');
      }

      // =====================================
      // STEP 2 FETCH LAST TRANSACTION
      // =====================================

      const lastTxn =
        await this.transactionrepo.getLastTransaction(dto.loan_id);

      // =====================================
      // STEP 3 OPENING BALANCE
      // =====================================
      // let principalBalance = lastTxn
      //   ? Number(lastTxn.principal_balance)
      //   : Number(loan.principal_amount);

      let principalBalance =
        Number(loan.principal_balance);

      // let accruedInterest =
      //   Number(loan.accrued_interest);

      const dailyInterestRow =
        await this.transactionrepo.getInterestAsOfDate(
          dto.loan_id,
          dto.transaction_date
        );

      let accruedInterest =
        Number(
          dailyInterestRow?.accrued_interest || 0
        );

      let interestBalance = lastTxn
        ? Number(lastTxn.interest_balance)
        : Number(loan.interest_amount);

      let overdueBalance = lastTxn
        ? Number(lastTxn.overdue_balance)
        : Number(loan.overdue_amount || 0);

      let principalPaid = 0;
      let interestPaid = 0;
      let overduePaid = 0;
      let topupAmount = 0;
      let topupInterest = 0;

      const totalPaid = Number(dto.paid_amount || 0);

      const previousTotalBalance =
        Number(loan.total_amount || 0);

      let totalBalance = previousTotalBalance;

      const transactionDateo = new Date(dto.transaction_date);
      const dueDateo = new Date(loan.due_date);

      transactionDateo.setHours(0, 0, 0, 0);
      dueDateo.setHours(0, 0, 0, 0);

      const isOverdue = transactionDateo > dueDateo;


      // =====================================
      // STEP 4 TRANSACTION TYPE LOGIC
      // =====================================

      const handleInterestPayment = () => {

        const payableInterest =
          isOverdue
            ? accruedInterest
            : interestBalance;


        if (interestPaid > payableInterest) {
          throw new BadRequestException(
            'Interest exceeds payable interest',
          );
        }

        accruedInterest -= interestPaid;

        interestBalance -= interestPaid;

        if (isOverdue && interestBalance < 0) {
          interestBalance = 0;
        }

        if (accruedInterest < 0) {
          accruedInterest = 0;
        }

      };

      switch (dto.transaction_type) {

        case 'Loan Amount Paid':
          principalPaid = Number(dto.principal_paid || 0);

          // if (principalPaid > principalBalance) {

          //   throw new BadRequestException(
          //     'Principal exceeds balance',
          //   );

          // }

          // principalBalance -= principalPaid;

          principalBalance -= principalPaid;

          if (principalBalance < 0) {
            throw new BadRequestException(
              'Principal exceeds balance'
            );
          }

          break;

        case 'Interest Amount Paid':
          interestPaid = Number(dto.interest_paid || 0);

          // if (interestPaid > interestBalance) {
          //   throw new BadRequestException(
          //     'Interest exceeds balance',
          //   );
          // }

          // interestBalance -= interestPaid;

          // accruedInterest -= interestPaid;

          // if (accruedInterest < 0) {
          //   throw new BadRequestException(
          //     'Interest exceeds accrued interest'
          //   );
          // }



          handleInterestPayment();

          break;


        case 'Loan + Interest Amount Paid':
          principalPaid = Number(dto.principal_paid || 0);
          interestPaid = Number(dto.interest_paid || 0);


          handleInterestPayment();


          principalBalance -= principalPaid;


          if (principalBalance < 0) {
            throw new BadRequestException(
              'Principal exceeds balance'
            );
          }

          break;

        case 'TOPUP':

          topupAmount = Number(dto.topup_amount);

          principalBalance += topupAmount;

          totalBalance =
            previousTotalBalance + topupAmount;

          break;

        default:
          throw new BadRequestException(
            'Invalid transaction type',
          );
      }



      if (dto.transaction_type !== 'TOPUP') {
        totalBalance =
          principalBalance +
          accruedInterest +
          overdueBalance;
      }

      console.log("total balance is", totalBalance);

      let loanStatus = 'active';

      if (Number(totalBalance).toFixed(2) === '0.00') {
        loanStatus = 'close';
      }

      const loanUpdatePayload: any = { loan_status: loanStatus };
      if (dto.transaction_type === 'TOPUP') {
        loan.total_topup_amount =
          Number(loan.total_topup_amount) + topupAmount;

        loanUpdatePayload.total_topup_amount = loan.total_topup_amount;

      }

      // =====================================
      // STEP 5 INSERT TRANSACTION ONLY
      // =====================================
      const result =
        await this.db.transaction(async (conn) => {
          dto.receipt_no = await this.transactionrepo.generateNumber(companyId, "TRANSACTION", conn);

          const insertResult =
            await this.transactionrepo.insertTransaction(
              {
                ...dto,
                client_id: loan.client_id,
                loan_id: dto.loan_id,

                principal_paid: principalPaid,
                interest_paid: interestPaid,
                overdue_paid: overduePaid,
                topup_amount: topupAmount,

                principal_balance: principalBalance,
                interest_balance: interestBalance,
                overdue_balance: overdueBalance,
                total_balance: totalBalance,

                // ✅ handle dates
                transaction_date:
                  dto.transaction_type === 'TOPUP'
                    ? null
                    : transactionDateTime,

                topup_date:
                  dto.transaction_type === 'TOPUP'
                    ? transactionDateTime
                    : null,

                created_by: userId,
              },
              conn,
            );

          const insertId =
            insertResult.insertId;

          if (
            interestPaid > 0 &&
            dto.transaction_date
          ) {
            await this.transactionrepo.adjustFutureDailyInterest(
              dto.loan_id,
              dto.transaction_date,
              interestPaid,
              conn
            );
          }


          if (
            principalPaid > 0 &&
            dto.transaction_date &&
            (
              dto.transaction_type === 'Loan Amount Paid' ||
              dto.transaction_type === 'Loan + Interest Amount Paid'
            )
          ) {

            await this.transactionrepo.recalculatePrincipalPaymentInterest(
              dto.loan_id,
              dto.transaction_date,
              principalPaid,
              loan.interest_rate,
              conn
            );
          }

          const latestInterest =
            await this.transactionrepo.getLatestDailyInterest(
              dto.loan_id,
              conn
            );

          if (dto.transaction_type !== 'TOPUP') {

            totalBalance =
              principalBalance +
              Number(latestInterest || 0) +
              overdueBalance;

          }


          console.log("latest daily ineterst is", latestInterest);

          // only update status in loan table
          await this.transactionrepo.updateLoanBalance(
            dto.loan_id,
            loanUpdatePayload,
            conn,
          );

          await this.transactionrepo.updateLoanRunningBalance(
            dto.loan_id,
            {
              principal_balance: principalBalance,
              accrued_interest: latestInterest,
              total_amount: totalBalance,
            },
            conn
          );

          // await this.transactionrepo.updateTodayDailyInterest(
          //   dto.loan_id,
          //   accruedInterest,
          //   conn
          // );

          // -------------------------------------
          // Ledger Entry 1
          // DR Loan Receivable
          // -------------------------------------

          const istNow = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd HH:mm:ss');

          const latestLoanBalance: any =
            await this.transactionrepo.getLatestLoanBalance(
              dto.loan_id,
              conn
            );


          const latestAccountBalance: any =
            await this.transactionrepo.getLatestAccountBalance(
              dto.account_type,
              conn
            );

          const latestInterestBalance =
            await this.transactionrepo.getLatestInterestBalance(dto.loan_id, conn);


          if (dto.transaction_type === 'TOPUP') {

            const loanBalanceAfter =
              latestLoanBalance + Number(topupAmount);

            const accountBalanceAfter =
              latestAccountBalance - Number(topupAmount);

            //  await this.transactionrepo.updateBankBalance(dto.account_type,accountBalanceAfter,conn)

            // CR Account (cash/bank decrease)
            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,
                account_id: dto.account_type,
                balance_after: accountBalanceAfter,
                debit: topupAmount,
                credit: 0,
                entry_type: dto.transaction_type,
                status: "debit",
                type: "account",
                entry_date: istNow,
                transaction_date: transactionDateTime,

              },
              conn
            );


            // CR Loan Receivable (asset increase)
            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,
                balance_after: loanBalanceAfter,
                debit: 0,
                credit: topupAmount,
                entry_type: dto.transaction_type,
                status: "credit",
                type: "loan",
                entry_date: istNow,
                transaction_date: transactionDateTime,

              },
              conn
            );

          }

          else if (dto.transaction_type === 'Loan + Interest Amount Paid') {

            const loanBalanceAfter =
              latestLoanBalance - principalPaid;

            let runningAccountBalance = latestAccountBalance;

            runningAccountBalance += principalPaid;
            // =========================
            // 1. DR Loan Receivable
            // =========================

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,

                debit: principalPaid,
                credit: 0,

                entry_type: dto.transaction_type,

                balance_after: loanBalanceAfter,

                status: "debit",
                type: "loan",

                entry_date: istNow,
                transaction_date: transactionDateTime,
              },
              conn
            );

            // =========================
            // 2. CR Bank Account
            // =========================

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,

                account_id: dto.account_type,

                debit: 0,
                credit: principalPaid,

                entry_type: dto.transaction_type,

                balance_after: runningAccountBalance,

                status: "credit",
                type: "account",

                entry_date: istNow,
                transaction_date: transactionDateTime,
              },
              conn
            );

            // =========================
            // 3. DR Interest Income
            // =========================
            runningAccountBalance += interestPaid;

            const interestBalanceAfter =
              latestInterestBalance + interestPaid;

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,

                debit: interestPaid,
                credit: 0,

                entry_type: dto.transaction_type,

                balance_after: interestBalanceAfter,

                status: "debit",
                type: "interest",

                entry_date: istNow,
                transaction_date: transactionDateTime,
              },
              conn
            );

            // =========================
            // 4. CR Bank Account
            // =========================

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,

                account_id: dto.account_type,

                debit: 0,
                credit: interestPaid,

                entry_type: dto.transaction_type,

                balance_after: runningAccountBalance,

                status: "credit",
                type: "account",

                entry_date: istNow,
                transaction_date: transactionDateTime,
              },
              conn
            );

            // await this.transactionrepo.updateBankBalance(dto.account_type,runningAccountBalance,conn)

          }

          else if (dto.transaction_type === 'Interest Amount Paid') {

            const accountBalanceAfter =
              latestAccountBalance + interestPaid;

            const interestBalanceAfter =
              latestInterestBalance + interestPaid;
            // =========================
            // 1. DR Interest Income
            // =========================



            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,

                debit: interestPaid,
                credit: 0,

                entry_type: dto.transaction_type,

                balance_after: interestBalanceAfter,

                status: "debit",
                type: "interest",

                entry_date: istNow,
                transaction_date: transactionDateTime,
              },
              conn
            );

            // =========================
            // 2. CR Bank/Cash Account
            // =========================

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,

                account_id: dto.account_type,

                debit: 0,
                credit: interestPaid,

                entry_type: dto.transaction_type,

                balance_after: accountBalanceAfter,

                status: "credit",
                type: "account",

                entry_date: istNow,
                transaction_date: transactionDateTime,
              },
              conn
            );

            // await this.transactionrepo.updateBankBalance(dto.account_type,accountBalanceAfter,conn)

          }

          else {

            const loanBalanceAfter =
              latestLoanBalance - principalPaid;

            const accountBalanceAfter =
              latestAccountBalance + principalPaid;

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,
                credit: 0,
                debit: principalPaid,
                entry_type: dto.transaction_type,
                balance_after: loanBalanceAfter,
                status: "debit",
                type: "loan",
                entry_date: istNow,
                transaction_date: transactionDateTime,

              },
              conn
            );

            // -------------------------------------
            // Ledger Entry 2
            // CR Selected Account
            // -------------------------------------

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,
                account_id: dto.account_type,
                debit: 0,
                credit: principalPaid,
                entry_type: dto.transaction_type,
                balance_after: accountBalanceAfter,

                status: "credit",
                type: "account",
                entry_date: istNow,
                transaction_date: transactionDateTime,


              },
              conn
            );

            // await this.transactionrepo.updateBankBalance(dto.account_type,accountBalanceAfter,conn)
          }
          
          return insertId;
        });



      console.log("result is", result);
      transactionId = result;


      if (!transactionId) {
        throw new Error(
          'Failed to create transaction',
        );
      }

      // =====================================
      // STEP 6 FILE SAVE OUTSIDE TRANSACTION
      // =====================================
      folderPath =
        `uploads/transaction/${transactionId}`;

      await fs.promises.mkdir(folderPath, {
        recursive: true,
      });

      const paymentProof =
        await this.saveTransactionFile(
          paymentProofFile,
          transactionId,
          'payment_proof',
          folderPath,
        );

      await this.transactionrepo.updateTransactionFile(
        transactionId,
        {
          payment_proof_path:
            paymentProof.dbPath,
        },
      );

      return {
        success: true,
        message:
          'Transaction completed successfully',
        transaction_id: transactionId,
      };
    } catch (error) {
      // cleanup files
      if (folderPath && fs.existsSync(folderPath)) {
        await fs.promises.rm(folderPath, {
          recursive: true,
          force: true,
        });
      }

      Sentry.captureException(error);


      throw error;
    }
  }


  private async saveTransactionFile(
    file: Express.Multer.File | undefined,
    transactionId: number,
    prefix: string,
    folderPath: string,
  ): Promise<{ dbPath: string | null; filePath: string | null }> {
    if (!file) {
      return {
        dbPath: null,
        filePath: null,
      };
    }

    const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf'];

    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedTypes.includes(ext)) {
      throw new BadRequestException('Invalid file type');
    }

    const fileName = `${prefix}_${transactionId}_${uuidv4()}${ext}`;

    const filePath = path.join(folderPath, fileName);

    const dbPath = `/${folderPath}/${fileName}`;

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      dbPath,
      filePath,
    };
  }



  async getLoanById(loanId: number) {

    try {

      if (!loanId) {
        throw new BadRequestException("loan id is missing");
      }

      const data = await this.transactionrepo.getLoanDetails(loanId);

      return {
        message: "loan fetched succesfully"
        , data
      }
    }
    catch (error) {

      Sentry.captureException(error);


      console.error("get loan by id error is", error)

    }
  }

  async searchClient(search: string, comapanyid: number) {
    try {

      const data = await this.transactionrepo.getSearchClient(search, comapanyid);



      if (!data || data.length === 0) {
        return {
          message: "no Client found",
          data: [],
        }
      }

      return {
        success: true,
        message: "Client fetched succesfully",
        data
      }
    } catch (error) {

      Sentry.captureException(error);

      console.error("Search Client error", error)

      throw new InternalServerErrorException("Failed to get updated data",);
    }
  }

  async getClientLoans(
    clientId: number,
    companyId: number,
    transactionDate?: string
  ) {

    try {

      const rows =
        await this.transactionrepo.getClientLoans(
          clientId,
          companyId,
          transactionDate
        );


      const grouped = rows.reduce((acc, row) => {

      const startDate = DateTime.fromJSDate(
  new Date(row.loan_start_date),
  { zone: 'Asia/Kolkata' }
).startOf('day');

const now = DateTime.now()
  .setZone('Asia/Kolkata')
  .startOf('day');

const diff = now.diff(startDate, [
  'years',
  'months',
  'days'
]).toObject();

const years = Math.floor(diff.years || 0);
const months = Math.floor(diff.months || 0);
const days = Math.floor(diff.days || 0) + 1;

const duration = [
  years ? `${years} year${years > 1 ? 's' : ''}` : '',
  months ? `${months} month${months > 1 ? 's' : ''}` : '',
  days ? `${days} day${days > 1 ? 's' : ''}` : ''
]
.filter(Boolean)
.join(' ');

        let loan = acc.find(
          (item) => item.loan_id === row.loan_id
        );

        if (!loan) {

          loan = {

            loan_id: row.loan_id,

            principal_amount:
              Number(row.principal_amount || 0),

            interest_amount:
              Number(row.interest_amount || 0),

            total_amount:
              Number(row.principal_amount || 0)
              + Number(row.interest_amount || 0),

                total_duration: duration,


            loan_status: row.loan_status,

            loan_no: row.loan_document_number,

            loan_start_date:
              row.loan_start_date,

            last_transaction_date:
              row.last_transaction_date,

            loan_end_date:
              row.loan_end_date,

            topup_date:
              row.topup_date,

            mortgaged_items: []
          };

          acc.push(loan);
        }

        if (row.gold_item_id) {

          loan.mortgaged_items.push({

            gold_item_id: row.gold_item_id,

            category: row.category,

            morgaged_note: row.morgaged_note
          });
        }

        return acc;

      }, []);

      return {

        success: true,

        message: "Loans fetched successfully",

        data: grouped
      };

    } catch (error) {

      Sentry.captureException(error);


      console.error(error);

      throw new InternalServerErrorException(
        "Failed to fetch loans"
      );
    }
  }

  async getReceipt(transactionId: number, companyId: number) {

    try {

      const rows = await this.transactionrepo.getTransactionReceipt(
        transactionId,
        companyId
      );

      if (!rows || rows.length === 0) {
        return {
          success: false,
          message: "Receipt not found"
        };
      }

      const grouped = rows.reduce((acc, row) => {
        let receipt = acc.find(
          (item) => item.transaction_id === row.transaction_id
        );

        if (!receipt) {
          receipt = {
            transaction_id: row.transaction_id,
            transaction_type: row.transaction_type,
            transaction_date: row.transaction_date,
            paid_amount: Math.round(row.paid_amount),
            payment_method: row.payment_method,
            company_name: row.company_name,
            client_name: row.client_name,
            client_code: row.client_code,
            loan_number: row.loan_document_number,
            principal_balanace: row.principal_balance,
            interest_balance: row.accrued_interest,
            total_balance: row.total_amount,
            loan_status: row.loan_status,
            loan_start_date: row.loan_start_date,
            loan_due_date: row.due_date,
            company_liscense: row.license_number,
            company_note: row.note,
            company_logo: row.company_logo,
            company_address: row.address,
            // mortgaged_items: []
          };

          if (row.transaction_type === "INTEREST_ONLY") {
            receipt.interest_paid = row.interest_paid;
          }

          if (row.transaction_type === "LOAN_AMOUNT_ONLY") {
            receipt.principal_paid = row.principal_paid;
          }

          if (row.transaction_type === "LOAN_PLUS_INTEREST") {
            receipt.principal_paid = row.principal_paid;
            receipt.interest_paid = row.interest_paid;
          }

          acc.push(receipt);


        }

        // if (row.gold_item_id) {
        //   receipt.mortgaged_items.push({
        //     gold_item_id: row.gold_item_id,
        //     category: row.category,
        //     morgaged_note: row.morgaged_note,
        //     gorss_weight: row.gross_weight,
        //     net_weight: row.net_weight,
        //     total_weight: row.total_weight
        //   });
        // }

        return acc;
      }, []);

      return {
        success: true,
        message: "Receipt fetched successfully",
        data: grouped[0]
      };

    } catch (error) {

      Sentry.captureException(error);

      throw new InternalServerErrorException(
        "Failed to fetch receipt"
      );
    }
  }
}
