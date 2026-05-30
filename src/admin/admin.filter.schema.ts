/* eslint-disable prettier/prettier */

export const ADMIN_FILTER_SCHEMA = {

  firstname: {
    column: 'ad.first_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  lastname: {
    column: 'ad.last_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  id:{
       column: 'ad.admin_id',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  username: {
    column: 'ad.user_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  email: {
    column: 'ad.admin_email',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  phone: {
    column: 'ad.admin_phone',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },


    status: {
    column: 'ad.status',
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
