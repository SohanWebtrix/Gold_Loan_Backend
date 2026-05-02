/* eslint-disable prettier/prettier */

export const LEDURE_FILTER_SCHEMA = {

      transaction_id: {
        column: 'le.transaction_id',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

        client_name: {
        column: "CONCAT(c1.first_name, ' ', c1.last_name)",
        type: 'text',
        operators: ['contains', 'equals', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

     loan_no: {
        column: 'l.loan_document_number',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

       account_name: {
        column: 'ac.account_type',
        type: 'text',
     operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
        },


          entry_type: {
        column: 'le.entry_type',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    status:{
        column: 'le.status',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    }

};