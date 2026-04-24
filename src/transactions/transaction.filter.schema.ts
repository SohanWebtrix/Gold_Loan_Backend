/* eslint-disable prettier/prettier */


export const TRANSACTION_FILTER_SCHEMA = {


    receipt_no: {
        column: 'tr.receipt_no ',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    loan_document_number: {
        column: 'l.loan_document_number ',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    customer_name: {
        column: "CONCAT(c1.first_name, ' ', c1.last_name)",
        type: 'text',
        operators: ['contains', 'equals', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    transaction_type: {
        column: 'tr.transaction_type',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    payment_method: {
        column: 'tr.payment_method',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

   
    transaction_date: {
        column: 'tr.transaction_date',
        type: 'date',
        operators: ['equals', 'before', 'after', 'between'],
    },

    status: {
        column: 'tr.status',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },


};