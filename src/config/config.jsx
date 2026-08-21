// src/config/config.js
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier'
};

export const STORAGE_KEYS = {
  CASHIER_DATA: 'cashierData',
  ADMIN_DATA: 'adminData',
  MANAGER_DATA: 'managerData',
  SELECTED_SHOP: 'selectedShop',
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData'
};

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const APP_CONFIG = {
  name: 'PAMELA THE PLACE MANAGEMENT',
  version: '1.0.0',
  contact: {
    phone: '+254 746082039',
    email: 'ichigoeliud021@gmail.com'
  }
};

// Default export for easier importing
const config = {
  ROLES,
  STORAGE_KEYS,
  API_BASE_URL,
  APP_CONFIG
};

export default config;