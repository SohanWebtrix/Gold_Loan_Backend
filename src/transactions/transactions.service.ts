/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { TRANSACTION_FILTER_SCHEMA } from './transaction.filter.schema';
import { TransactionRepository } from './transaction.repository/transaction.repository';
import { DatabaseService } from 'src/database/database.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

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

  // async createTransaction(dto, paymentProofFile: Express.Multer.File | undefined, userId, companyId) {

  //   let folderPath: string | null = null;
  //   let transactionid: number | null = null;

  //   try {

  //     dto.company_id = companyId;
  //     dto.receipt_no = this.generateReciptCode();

  //     console.log("company id is ", companyId)
  //     // STEP 1 Fetch Loan (outside transaction)
  //     const loan = await this.transactionrepo.getLoanById(dto.loan_id);

  //     if (!loan) {
  //       throw new BadRequestException('Loan not found');
  //     }

  //     let principalBalance =
  //       Number(
  //         loan.principal_amount,
  //       );

  //     let interestBalance =
  //       Number(
  //         loan.interest_amount,
  //       );

  //     let overdueBalance =
  //       Number(
  //         loan.overdue_amount || 0,
  //       );

  //     let principalPaid = 0;
  //     let interestPaid = 0;
  //     let overduePaid = 0;
  //     let topupAmount = 0;

  //     const totalPaid =
  //       Number(dto.paid_amount || 0);


  //     // STEP 2 Calculations (outside transaction)
  //     // ==========================
  //     // STEP 2 : TRANSACTION TYPE
  //     // ==========================

  //     switch (
  //     dto.transaction_type
  //     ) {

  //       // -----------------------
  //       // PRINCIPAL ONLY
  //       // -----------------------
  //       case 'LOAN_AMOUNT_ONLY':

  //         principalPaid =
  //           Number(
  //             dto.principal_paid || 0,
  //           );

  //         if (
  //           principalPaid >
  //           principalBalance
  //         ) {
  //           throw new BadRequestException(
  //             'Principal exceeds balance',
  //           );
  //         }

  //         principalBalance -=
  //           principalPaid;

  //         break;


  //       // -----------------------
  //       // INTEREST ONLY
  //       // -----------------------
  //       case 'INTEREST_ONLY':

  //         interestPaid =
  //           Number(
  //             dto.interest_paid || 0,
  //           );

  //         if (
  //           interestPaid >
  //           interestBalance
  //         ) {
  //           throw new BadRequestException(
  //             'Interest exceeds balance',
  //           );
  //         }

  //         interestBalance -=
  //           interestPaid;

  //         break;


  //       // -----------------------
  //       // PRINCIPAL + INTEREST + OVERDUE
  //       // -----------------------
  //       case 'LOAN_PLUS_INTEREST':

  //         principalPaid =
  //           Number(
  //             dto.principal_paid || 0,
  //           );

  //         interestPaid =
  //           Number(
  //             dto.interest_paid || 0,
  //           );

  //         overduePaid =
  //           Number(
  //             dto.overdue_paid || 0,
  //           );

  //         if (
  //           principalPaid >
  //           principalBalance
  //         ) {
  //           throw new BadRequestException(
  //             'Principal exceeds balance',
  //           );
  //         }

  //         if (
  //           interestPaid >
  //           interestBalance
  //         ) {
  //           throw new BadRequestException(
  //             'Interest exceeds balance',
  //           );
  //         }

  //         if (
  //           overduePaid >
  //           overdueBalance
  //         ) {
  //           throw new BadRequestException(
  //             'Overdue exceeds balance',
  //           );
  //         }

  //         principalBalance -=
  //           principalPaid;

  //         interestBalance -=
  //           interestPaid;

  //         overdueBalance -=
  //           overduePaid;

  //         break;


  //       // -----------------------
  //       // TOPUP
  //       // -----------------------
  //       case 'TOPUP':

  //         topupAmount =
  //           totalPaid;

  //         principalBalance +=
  //           topupAmount;

  //         break;

  //       default:
  //         throw new BadRequestException(
  //           'Invalid transaction type',
  //         );
  //     }

  //     const totalBalance =
  //       principalBalance +
  //       interestBalance +
  //       overdueBalance;

  //     let loanStatus = loan.loan_status;

  //     if (Number(totalBalance).toFixed(2) === '0.00') {
  //       loanStatus = 'close';
  //     }

  //     // STEP 3 Short transaction only
  //     const result = await this.db.transaction(async (conn) => {

  //       const insertResult = await this.transactionrepo.insertTransaction(
  //         {
  //           ...dto,
  //           client_id: loan.client_id,
  //           loan_id: dto.loan_id,

  //           principal_paid: principalPaid,
  //           interest_paid: interestPaid,
  //           overdue_paid: overduePaid,
  //           topup_amount: topupAmount,

  //           principal_balance: principalBalance,
  //           interest_balance: interestBalance,
  //           overdue_balance: overdueBalance,
  //           total_balance: totalBalance,

  //           created_by: userId
  //         },
  //         conn
  //       );

  //       const insertId = insertResult[0].insertId;

  //       // ==========================
  //       // STEP 4 : UPDATE LOAN
  //       // ==========================
  //       await this.transactionrepo.updateLoanBalance(
  //         dto.loan_id,
  //         {
  //           principal_amount:
  //             principalBalance,

  //           interest_amount:
  //             interestBalance,

  //           total_amount:
  //             totalBalance,

  //           loan_status:
  //             loanStatus,
  //         },
  //         conn,
  //       );


  //       return insertId;
  //     });


  //     transactionid = result;

  //     if (!transactionid) {
  //       throw new Error('Failed to create transaction');
  //     }

  //     folderPath = `uploads/transaction/${transactionid}`;
  //     await fs.promises.mkdir(folderPath, { recursive: true });

  //     const paymentProof = await this.saveTransactionFile(
  //       paymentProofFile,
  //       transactionid,
  //       'payment_proof',
  //       folderPath,
  //     );

  //     // update path outside transaction
  //     await this.transactionrepo.updateTransactionFile(
  //       transactionid,
  //       {
  //         payment_proof_path: paymentProof.dbPath,
  //       },
  //     );

  //     return {
  //       success: true,
  //       message: 'Transaction completed successfully',
  //       transaction_id: transactionid,
  //     };

  //   }
  //   catch (error) {
  //     console.error("error is", error);

  //     // delete folder
  //     if (folderPath && fs.existsSync(folderPath)) {
  //       await fs.promises.rm(folderPath, {
  //         recursive: true,
  //         force: true
  //       });
  //     }

  //     throw error;
  //   }
  // }


  // ==============================
  // FILE SAVE METHOD
  // ==============================


  // ============================================
  // CREATE TRANSACTION (Updated Proper Version)
  // Loan amounts stay unchanged
  // Remaining balance comes from last transaction
  // ============================================

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
          topupAmount = totalPaid;

          // topup adds principal outstanding
          principalBalance += topupAmount;
          break;

        default:
          throw new BadRequestException(
            'Invalid transaction type',
          );
      }

      const totalBalance =
        principalBalance +
        interestBalance +
        overdueBalance;

      let loanStatus = 'active';

      if (Number(totalBalance).toFixed(2) === '0.00') {
        loanStatus = 'close';
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
            { loan_status: loanStatus },
            conn,
          );

             // -------------------------------------
        // Ledger Entry 1
        // DR Loan Receivable
        // -------------------------------------

          await this.transactionrepo.insertLedger(
            {
              transaction_id: insertId,
              loan_id: dto.loan_id,
              client_id: loan.client_id,
              company_id: companyId,
              credit: 0,
              debit: dto.paid_amount,
              entry_type:dto.transaction_type,
              status:"debit",
              type:"loan"
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
              debit:0,
              credit: dto.paid_amount,
              entry_type: dto.transaction_type,
              status:"credit",
              type:"account"
            },
            conn
          );

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


  async getClientLoans(clientId: number, companyId: number) {

    try {
      const rows = await this.transactionrepo.getClientLoans(clientId, companyId);

      const grouped = rows.reduce((acc, row) => {
        let loan = acc.find((item) => item.loan_id === row.loan_id);

        if (!loan) {
          loan = {
            loan_id: row.loan_id,
            principal_amount: row.principal_amount,
            interest_amount: row.interest_amount,
            loan_status: row.loan_status,
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
      throw new InternalServerErrorException("Failed to fetch loans");
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
