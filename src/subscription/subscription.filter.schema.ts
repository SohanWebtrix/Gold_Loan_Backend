/* eslint-disable prettier/prettier */


export const SUBSCRIPTION_FILTER_SCHEMA = {

    sub_id: {
        column: 'sb.sub_id',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    transaction_id: {
        column: 'sb.transaction_id',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    company_id: {
        column: 'sb.company_id ',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    companyName: {
        column: 'cm.company_name',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    subscription_type: {
        column: 'sb.subscription_type',
        type: 'text',
        operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
    },

    transaction_date: {
        column: 'sb.transaction_date',
        type: 'date',
        operators: ['equals', 'before', 'after', 'between'],
    },

    startDate: {
        column: 'sb.subscription_start_date',
        type: 'date',
        operators: ['equals', 'before', 'after', 'between'],
    },

    endDate: {
        column: 'sb.subscription_end_date',
        type: 'date',
        operators: ['equals', 'before', 'after', 'between'],
    },
};