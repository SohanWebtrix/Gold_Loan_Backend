/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { TRANSACTION_FILTER_SCHEMA } from './transaction.filter.schema';
import { TransactionRepository } from './transaction.repository/transaction.repository';
import { DatabaseService } from 'src/database/database.service';
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

  async createTransaction(dto, userId, companyId) {


    dto.company_id = companyId;
    dto.receipt_no = this.generateReciptCode();

    console.log("company id is ", companyId)
    // STEP 1 Fetch Loan (outside transaction)
    const loan = await this.transactionrepo.getLoanById(dto.loan_id);

    if (!loan) {
      throw new BadRequestException('Loan not found');
    }

    let principalBalance =
      Number(
        loan.principal_amount,
      );

    let interestBalance =
      Number(
        loan.interest_amount,
      );

    let overdueBalance =
      Number(
        loan.overdue_amount || 0,
      );

    let principalPaid = 0;
    let interestPaid = 0;
    let overduePaid = 0;
    let topupAmount = 0;

    const totalPaid =
      Number(dto.paid_amount || 0);


    // STEP 2 Calculations (outside transaction)
    // ==========================
    // STEP 2 : TRANSACTION TYPE
    // ==========================

    switch (
    dto.transaction_type
    ) {

      // -----------------------
      // PRINCIPAL ONLY
      // -----------------------
      case 'LOAN_AMOUNT_ONLY':

        principalPaid =
          Number(
            dto.principal_paid || 0,
          );

        if (
          principalPaid >
          principalBalance
        ) {
          throw new BadRequestException(
            'Principal exceeds balance',
          );
        }

        principalBalance -=
          principalPaid;

        break;


      // -----------------------
      // INTEREST ONLY
      // -----------------------
      case 'INTEREST_ONLY':

        interestPaid =
          Number(
            dto.interest_paid || 0,
          );

        if (
          interestPaid >
          interestBalance
        ) {
          throw new BadRequestException(
            'Interest exceeds balance',
          );
        }

        interestBalance -=
          interestPaid;

        break;


      // -----------------------
      // PRINCIPAL + INTEREST + OVERDUE
      // -----------------------
      case 'LOAN_PLUS_INTEREST':

        principalPaid =
          Number(
            dto.principal_paid || 0,
          );

        interestPaid =
          Number(
            dto.interest_paid || 0,
          );

        overduePaid =
          Number(
            dto.overdue_paid || 0,
          );

        if (
          principalPaid >
          principalBalance
        ) {
          throw new BadRequestException(
            'Principal exceeds balance',
          );
        }

        if (
          interestPaid >
          interestBalance
        ) {
          throw new BadRequestException(
            'Interest exceeds balance',
          );
        }

        if (
          overduePaid >
          overdueBalance
        ) {
          throw new BadRequestException(
            'Overdue exceeds balance',
          );
        }

        principalBalance -=
          principalPaid;

        interestBalance -=
          interestPaid;

        overdueBalance -=
          overduePaid;

        break;


      // -----------------------
      // TOPUP
      // -----------------------
      case 'TOPUP':

        topupAmount =
          totalPaid;

        principalBalance +=
          topupAmount;

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

    let loanStatus = loan.loan_status;

    if (Number(totalBalance).toFixed(2) === '0.00') {
      loanStatus = 'close';
    }

    // STEP 3 Short transaction only
    return this.db.transaction(async (conn) => {

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

          created_by: userId
        },
        conn
      );

      // ==========================
      // STEP 4 : UPDATE LOAN
      // ==========================
      await this.transactionrepo.updateLoanBalance(
        dto.loan_id,
        {
          principal_amount:
            principalBalance,

          interest_amount:
            interestBalance,

          total_amount:
            totalBalance,

          loan_status:
            loanStatus,
        },
        conn,
      );


      return {
        success: true,
        message: 'Transaction completed succesfully',
      };
    });
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
            mortgaged_items: []
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

        if (row.gold_item_id) {
          receipt.mortgaged_items.push({
            gold_item_id: row.gold_item_id,
            category: row.category,
            morgaged_note: row.morgaged_note,
            gorss_weight: row.gross_weight,
            net_weight: row.net_weight,
            total_weight: row.total_weight
          });
        }

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
