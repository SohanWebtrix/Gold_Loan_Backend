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

@Injectable()
export class TransactionsService {


  constructor(private readonly transactionrepo: TransactionRepository, private readonly db: DatabaseService,
  ) {

  }


  private generateReciptCode(): string {
    const randomPart = randomBytes(3).toString("hex").toUpperCase(); // 6 chars

    return `REC-${randomPart}`;
  }

  async getTransactionList(
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
          valueTo: f.valueTo

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
      let principalBalance = lastTxn
        ? Number(lastTxn.principal_balance)
        : Number(loan.principal_amount);

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

      // =====================================
      // STEP 4 TRANSACTION TYPE LOGIC
      // =====================================
      switch (dto.transaction_type) {
        case 'LOAN_AMOUNT_ONLY':
          principalPaid = Number(dto.principal_paid || 0);

          if (principalPaid > principalBalance) {
            throw new BadRequestException(
              'Principal exceeds balance',
            );
          }

          principalBalance -= principalPaid;
          break;

        case 'INTEREST_ONLY':
          interestPaid = Number(dto.interest_paid || 0);

          if (interestPaid > interestBalance) {
            throw new BadRequestException(
              'Interest exceeds balance',
            );
          }

          interestBalance -= interestPaid;
          break;

        case 'LOAN_PLUS_INTEREST':
          principalPaid = Number(dto.principal_paid || 0);
          interestPaid = Number(dto.interest_paid || 0);
          overduePaid = Number(dto.overdue_paid || 0);

          if (principalPaid > principalBalance) {
            throw new BadRequestException(
              'Principal exceeds balance',
            );
          }

          if (interestPaid > interestBalance) {
            throw new BadRequestException(
              'Interest exceeds balance',
            );
          }

          if (overduePaid > overdueBalance) {
            throw new BadRequestException(
              'Overdue exceeds balance',
            );
          }

          principalBalance -= principalPaid;
          interestBalance -= interestPaid;
          overdueBalance -= overduePaid;
          break;

        case 'TOPUP':
          topupAmount = Number(dto.topup_amount);

          console.log("interest amount when no transaction", interestBalance);
          console.log("principal amout when no transaction ", principalBalance);

          // Increase principal balance
          console.log("topup amount is", topupAmount)
          principalBalance += topupAmount;

          console.log("loan is ", loan);
          const endDate = new Date(loan.due_date);
          endDate.setUTCHours(0, 0, 0, 0);

          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);

          if (endDate < today) {
            throw new BadRequestException('Loan already expired. Cannot topup.');
          }

          // Interest starts from NEXT day, so add 1 to today
          const interestStartDate = new Date(today);
          interestStartDate.setUTCDate(interestStartDate.getUTCDate() + 1);


          const remainingDays = Math.max(0, Math.ceil(
            (endDate.getTime() - interestStartDate.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1); // +1 to include due date itself

          console.log("remaining days are", remainingDays);
          console.log("today is ", today)
          console.log("end date is", endDate);

          let dailyRate = 0;

          if (loan.duration_unit === 'month') {
            // annual rate ÷ 12 = monthly rate
            dailyRate = Number(loan.interest_rate) / 100 / 365;

          } else if (loan.duration_unit === 'day') {

            // annual rate ÷ 365 = daily rate
            dailyRate = Number(loan.interest_rate) / 100 / 365;
          }

          topupInterest = topupAmount * dailyRate * remainingDays;

          interestBalance += topupInterest;

          break;

        default:
          throw new BadRequestException(
            'Invalid transaction type',
          );
      }

      console.log("topup amoun is", topupAmount)
      console.log("principal balance is", principalBalance)
      console.log("interest balance is", interestBalance)
      console.log("topup interest is", topupInterest)

      const totalBalance =
        principalBalance +
        interestBalance +
        overdueBalance;

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

        loanUpdatePayload.total_amount =
          Number(loan.total_amount) + topupAmount + topupInterest;
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

                created_by: userId,
              },
              conn,
            );

          console.log('insertResult is', insertResult)
          const insertId =
            insertResult.insertId;

          console.log('inser id1 is', insertId);

          console.log("insert id in transaction is", insertId);

          // only update status in loan table
          await this.transactionrepo.updateLoanBalance(
            dto.loan_id,
            loanUpdatePayload,
            conn,
          );

          // -------------------------------------
          // Ledger Entry 1
          // DR Loan Receivable
          // -------------------------------------

          const istNow = DateTime.now().setZone('Asia/Kolkata').toFormat('yyyy-MM-dd HH:mm:ss');

          const latestLoanBalance =
            await this.transactionrepo.getLatestLoanBalance(
              dto.loan_id,
              conn
            );


          const latestAccountBalance =
            await this.transactionrepo.getLatestAccountBalance(
              dto.account_type,
              conn
            );


          if (dto.transaction_type === 'TOPUP') {

            const loanBalanceAfter =
              latestLoanBalance + Number(topupAmount);

            const accountBalanceAfter =
              latestAccountBalance - Number(topupAmount);


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
                entry_date: istNow
              },
              conn
            );

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
                entry_date: istNow
              },
              conn
            );

          }


          else {

            const loanBalanceAfter =
              latestLoanBalance - Number(dto.paid_amount);

            const accountBalanceAfter =
              latestAccountBalance + Number(dto.paid_amount);

            await this.transactionrepo.insertLedger(
              {
                transaction_id: insertId,
                loan_id: dto.loan_id,
                client_id: loan.client_id,
                company_id: companyId,
                credit: 0,
                debit: dto.paid_amount,
                entry_type: dto.transaction_type,
                balance_after: loanBalanceAfter,

                status: "debit",
                type: "loan",
                entry_date: istNow
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
                credit: dto.paid_amount,
                entry_type: dto.transaction_type,
                balance_after: accountBalanceAfter,

                status: "credit",
                type: "account",
                entry_date: istNow

              },
              conn
            );
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
      console.error("Search Client error", error)

      throw new InternalServerErrorException("Failed to get updated data",);
    }
  }


  // async getClientLoans(clientId: number, companyId: number) {

  //   try {
  //     const rows = await this.transactionrepo.getClientLoans(clientId, companyId);

  //     const grouped = rows.reduce((acc, row) => {
  //       let loan = acc.find((item) => item.loan_id === row.loan_id);

  //       if (!loan) {
  //         loan = {
  //           loan_id: row.loan_id,
  //           principal_amount: row.principal_amount,
  //           interest_amount: row.interest_amount,
  //           loan_status: row.loan_status,
  //           loan_no: row.loan_document_number,
  //           mortgaged_items: []
  //         };

  //         acc.push(loan);
  //       }

  //       if (row.gold_item_id) {
  //         loan.mortgaged_items.push({
  //           gold_item_id: row.gold_item_id,
  //           category: row.category,
  //           morgaged_note: row.morgaged_note
  //         });
  //       }

  //       return acc;
  //     }, []);

  //     return {
  //       success: true,
  //       message: "Loans fetched successfully",
  //       data: grouped
  //     };

  //   } catch (error) {
  //     throw new InternalServerErrorException("Failed to fetch loans");
  //   }
  // }

  async getClientLoans(clientId: number, companyId: number, transactionDate?: string
  ) {

    try {

      const rows = await this.transactionrepo.getClientLoans(
        clientId,
        companyId
      );

      const today = transactionDate
        ? new Date(transactionDate)
        : new Date();

      today.setHours(0, 0, 0, 0);

      if (isNaN(today.getTime())) {
        throw new BadRequestException(
          "Invalid transaction_date"
        );
      }

      const grouped = rows.reduce((acc, row) => {

        let loan = acc.find(
          (item) => item.loan_id === row.loan_id
        );

        if (!loan) {

          // -----------------------------
          // INTEREST CALCULATION
          // -----------------------------

          const interestStartDate = new Date(
            row.last_transaction_date || row.loan_start_date
          );

          interestStartDate.setHours(0, 0, 0, 0);

          if (row.last_transaction_date) {
            interestStartDate.setDate(
              interestStartDate.getDate() + 1
            );
          }

          const millisecondsPerDay =
            1000 * 60 * 60 * 24;

          const totalDays = Math.max(
            0,
            Math.floor(
              (today.getTime() -
                interestStartDate.getTime()) /
              millisecondsPerDay
            ) + 1
          );

          const dailyRate =
            Number(row.interest_rate) / 100 / 365;

          const interestAmount =
            Number(row.principal_amount) *
            dailyRate *
            totalDays;

          loan = {
            loan_id: row.loan_id,

            principal_amount: Number(
              row.principal_amount
            ),

            interest_amount: Number(
              interestAmount.toFixed(2)
            ),

            interest_days: totalDays,

            loan_status: row.loan_status,

            loan_no: row.loan_document_number,
            loan_start_date:row.loan_start_date,

          };

          acc.push(loan);
        }

        // if (row.gold_item_id) {

        //   loan.mortgaged_items.push({
        //     gold_item_id: row.gold_item_id,
        //     category: row.category,
        //     morgaged_note: row.morgaged_note
        //   });

        // }

        return acc;

      }, []);

      return {
        success: true,
        message: "Loans fetched successfully",
        data: grouped
      };

    } catch (error) {

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
            paid_amount: row.paid_amount,
            payment_method: row.payment_method,
            client_name: row.client_name,
            client_code: row.client_code,
            loan_number: row.loan_document_number,
            principal_balanace: row.principal_balance,
            interest_balance: row.interest_balance,
            total_balance: row.total_balance,
            loan_status: row.loan_status,
            loan_start_date: row.loan_start_date,
            loan_due_date: row.due_date,
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
      throw new InternalServerErrorException(
        "Failed to fetch receipt"
      );
    }
  }
}
