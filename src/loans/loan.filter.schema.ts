/* eslint-disable prettier/prettier */


export const LOAN_FILTER_SCHEMA = {

    loan_id: {
        column: 'lo.principal_amount',
        type: 'number',
        operators: ['equals', 'gt', 'gte', 'lt', 'lte'],
    },

    client_name: {
        column: "CONCAT(c1.first_name, ' ', c1.last_name)",
        type: 'text',
        operators: ['contains', 'equals', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },


    loan_start_date: {
        column: 'lo.loan_start_date',
        type: 'date',
        operators: ['equals', 'before', 'after'],
    },

    loan_document_number: {
        column: 'lo.loan_document_number',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    adhar_card: {
        column: 'lo.adhar_card',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    pan_card: {
        column: 'lo.pan_card',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    duration_months: {
        column: 'lo.duration_months',
        type: 'number',
        operators: ['equals', 'gt', 'gte', 'lt', 'lte'],
    },

    due_date: {
        column: 'lo.due_date',
        type: 'date',
        operators: ['equals', 'before', 'after'],
    },

    principal_amount: {
        column: 'lo.principal_amount',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },


    interest_amount: {
        column: 'lo.interest_amount',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    total_amount: {
        column: 'lo.total_amount',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    payment_type: {
        column: 'lo.payment_type',
        type: 'select',
        operators: ['equals', 'not_equals', 'isEmpty', 'is_not_empty'],
    },


    transaction_date: {
        column: 'lo.transaction_date',
        type: 'date',
        operators: ['equals', 'before', 'after'],
    },

    status: {
        column: 'cl.status',
        type: 'text',
        operators: ['equals', 'not_equals', 'isEmpty', 'is_not_empty'],
    },

    created_date: {
        column: 'cl.created_date',
        type: 'date',
        operators: ['equals', 'before', 'after', 'between'],
    },

    modified_date: {
        column: 'cl.modified_date',
        type: 'date',
        operators: ['equals', 'before', 'after', 'between'],
    },

};