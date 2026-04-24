/* eslint-disable prettier/prettier */

export const CUSTOMER_FILTER_SCHEMA = {

  first_name: {
    column: 'cl.first_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

    last_name: {
    column: 'cl.last_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

    caste: {
    column: 'cl.caste',
    type: 'text',
    operators: ['equals', 'not_equals', 'isEmpty', 'is_not_empty'],
  },

  status: {
    column: 'cl.status',
    type: 'text',
    operators: ['equals', 'not_equals', 'isEmpty', 'is_not_empty'],
  },

  client_code: {
    column: 'cl.client_code',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  mobile_no: {
    column: 'cl.mobile_no',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

    email: {
    column: 'cl.email',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  adhar_card: {
    column: 'cl.aadhaar_card_no',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with'],
  },

  pan_card_no: {
    column: 'cl.pan_card_no',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with'],
  },

  gender: {
    column: 'cl.gender',
    type: 'select',
    operators: ['equals', 'not_equals', 'isEmpty', 'is_not_empty'],
  },

  city: {
    column: 'ct.city_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

   state: {
    column: 'st.state_name',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

     street_address: {
    column: 'cl.state',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

  occupation: {
    column: 'cl.occupation',
    type: 'text',
    operators: ['equals', 'contains', 'starts_with', 'ends_with', 'isEmpty', 'is_not_empty'],
  },

      created_date: {
        column: 'cl.created_date',
        type: 'date',
        operators: ['equals', 'before', 'after','between'],
    },

    modified_date: {
        column: 'cl.modified_date',
        type: 'date',
        operators: ['equals', 'before', 'after','between'],
    },

};