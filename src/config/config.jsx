// src/config/config.js
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier'
};

const config = {
  HARDCODED_ADMIN: {
    email: 'ichigoeliud021@gmail.com',
    password: 'Eliud342*#'
  },
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'https://back-pos.vercel.app/api',
  APP_VERSION: '1.0.0',
  SECURITY: {
    PASSWORD_MIN_LENGTH: 4,
    PASSWORD_REQUIREMENTS: {
      UPPERCASE: false,
      LOWERCASE: false,
      NUMBERS: false,
      SPECIAL_CHARS: false
    }
  },
  MANAGER_PERMISSIONS: {
    CAN_VIEW_PROFIT: false,
    CAN_VIEW_NET_PROFIT: false,
    CAN_VIEW_GROSS_PROFIT: false,
    CAN_VIEW_MARGINS: false,
    CAN_MANAGE_INVENTORY: true,
    CAN_MANAGE_EXPENSES: true,
    CAN_VIEW_TRENDS: true,
    CAN_VIEW_STOCK_ALERTS: true
  }
};

export default config;