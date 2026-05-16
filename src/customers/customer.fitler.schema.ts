/* eslint-disable prettier/prettier */

export const CUSTOMER_FILTER_SCHEMA = {

  first_name: {
    column: 'cs.first_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },



  last_name: {
    column: 'cs.last_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  role:{
        column: 'cs.role',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  company_name: {
    column: 'cm.company_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  company_mobile: {
    column: 'cm.company_mobile',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  city:{
       column: 'cs.city',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],

  },

    state:{
       column: 'st.state_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],

  },

  company_email: {
    column: 'cm.company_email',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },



  status: {
    column: 'cs.status',
    type: 'text',
    operators: ['equals', 'not_equals', 'isEmpty', 'is_not_empty'],
  },



  cust_phone: {
    column: 'cs.cust_phone',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  cust_email: {
    column: 'cs.cust_email',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  created_date: {
    column: 'cs.created_date',
    type: 'date',
    operators: ['equals', 'before', 'after', 'between'],
  },

};