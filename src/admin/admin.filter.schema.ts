/* eslint-disable prettier/prettier */

export const ADMIN_FILTER_SCHEMA = {

  first_name: {
    column: 'ad.first_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  last_name: {
    column: 'ad.last_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  user_name: {
    column: 'ad.user_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  admin_email: {
    column: 'ad.admin_email',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  admin_phone: {
    column: 'ad.admin_phone',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  created_date: {
    column: 'ad.created_date',
    type: 'date',
    operators: ['equals', 'before', 'after', 'between'],
  },

  modified_date: {
    column: 'ad.modified_date',
    type: 'date',
    operators: ['equals', 'before', 'after', 'between'],
  },

};
