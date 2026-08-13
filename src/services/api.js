// src/services/api.js - CORRECTED WITH DEVICE VERIFICATION

import axios from 'axios';
import { CalculationUtils } from '../utils/calculationUtils';

// Enhanced Configuration
const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_BASE_URL || 'https://back-pos.vercel.app/api',
  timeout: 15000,
  retryAttempts: 2,
  retryDelay: 1000,
  cacheTimeout: 60000
};

// Enhanced Error handler
const handleApiError = (error) => {
  console.error('API Error Details:', {
    status: error.response?.status,
    data: error.response?.data,
    message: error.message,
    code: error.code,
    config: error.config
  });

  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please check your connection and try again.';
  }
  
  if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
    return 'Cannot connect to server. Please check if the backend is running.';
  }
  
  if (error.response?.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  if (error.response?.status === 404) {
    return 'Endpoint not found. Please check if the backend server is running.';
  }
  
  if (error.response?.status === 500) {
    const serverError = error.response?.data;
    if (serverError?.error) {
      if (serverError.error.includes('validation failed')) {
        const fieldErrors = serverError.errors ? Object.values(serverError.errors).map(err => err.message) : [];
        return `Validation failed: ${fieldErrors.join(', ')}`;
      }
      return serverError.error;
    }
    return 'Server error. Please try again later.';
  }
  
  if (error.response?.status === 400 || error.response?.status === 401) {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    return 'Invalid email or password. Please try again.';
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

// Enhanced Cache System
const createCache = () => {
  const cache = {
    data: {},
    timestamps: {},
    
    get: (key) => {
      const item = cache.data[key];
      const timestamp = cache.timestamps[key];
      if (item && timestamp && Date.now() - timestamp < API_CONFIG.cacheTimeout) {
        console.log(`🔄 Using cached data for: ${key}`);
        return item;
      }
      return null;
    },
    
    set: (key, data) => {
      cache.data[key] = data;
      cache.timestamps[key] = Date.now();
    },
    
    clear: (key) => {
      delete cache.data[key];
      delete cache.timestamps[key];
    },
    
    clearAll: () => {
      cache.data = {};
      cache.timestamps = {};
    },
    
    cleanup: () => {
      const now = Date.now();
      Object.keys(cache.timestamps).forEach(key => {
        if (now - cache.timestamps[key] > API_CONFIG.cacheTimeout) {
          delete cache.data[key];
          delete cache.timestamps[key];
        }
      });
    }
  };

  setInterval(() => cache.cleanup(), 300000);
  return cache;
};

const cache = createCache();

// Enhanced Axios Instance with Retry Logic
const createApiInstance = (baseURL = API_CONFIG.baseURL, customTimeout = null) => {
  const instance = axios.create({
    baseURL,
    timeout: customTimeout || API_CONFIG.timeout,
    headers: { 
      'Content-Type': 'application/json'
    }
  });

  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('adminToken') || 
                    localStorage.getItem('userToken') || 
                    localStorage.getItem('cashierToken') ||
                    localStorage.getItem('sessionToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      if (config.method === 'get') {
        config.params = {
          ...config.params,
          _t: Date.now()
        };
      }
      
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, config.params);
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  instance.interceptors.response.use(
    (response) => {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - Success`);
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      
      if ((error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR') && 
          !originalRequest._retryCount) {
        
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        if (originalRequest._retryCount <= API_CONFIG.retryAttempts) {
          console.log(`🔄 Retry attempt ${originalRequest._retryCount} for: ${originalRequest.url}`);
          
          const delay = API_CONFIG.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return instance(originalRequest);
        }
      }
      
      if (error.response?.status === 401) {
        // Don't redirect for device verification endpoints
        if (!originalRequest.url?.includes('/auth/check-device')) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('userToken');
          localStorage.removeItem('cashierToken');
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('adminData');
          localStorage.removeItem('cashierData');
          if (typeof window !== 'undefined') {
            window.location.href = '/cashier-login';
          }
        }
      }
      
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: error.response?.status,
        message: error.message,
        code: error.code,
        retryCount: originalRequest._retryCount
      });
      
      return Promise.reject(error);
    }
  );

  return instance;
};

// API instances for different timeouts
const api = createApiInstance();
const quickApi = createApiInstance(API_CONFIG.baseURL, 10000);
const fastApi = createApiInstance(API_CONFIG.baseURL, 5000);

// ==================== ENHANCED AUTH API SERVICE ====================

export const authAPI = {
  // ==================== CASHIER LOGIN ====================
  
  cashierLogin: async (credentials) => {
    try {
      console.log('🔐 Attempting cashier login...');

      localStorage.removeItem('cashierToken');
      localStorage.removeItem('cashierData');
      localStorage.removeItem('userToken');
      localStorage.removeItem('userData');

      let response;
      let usedEndpoint = '';
      
      const loginAttempts = [
        '/auth/cashier/login',
        '/cashier/login',
        '/auth/login'
      ];

      for (const endpoint of loginAttempts) {
        try {
          console.log(`🔄 Trying login endpoint: ${endpoint}`);
          const fastInstance = createApiInstance(API_CONFIG.baseURL, 8000);
          response = await fastInstance.post(endpoint, {
            email: credentials.email,
            password: credentials.password,
            role: 'cashier',
            deviceId: credentials.deviceId || localStorage.getItem('deviceId')
          });
          usedEndpoint = endpoint;
          console.log(`✅ Success with endpoint: ${endpoint}`);
          break;
        } catch (endpointError) {
          console.log(`❌ Failed with endpoint ${endpoint}:`, endpointError.response?.status);
          continue;
        }
      }

      if (!response) {
        throw new Error('All login endpoints failed. Please check backend routes.');
      }

      console.log('✅ Login response received:', response.data);

      const data = response.data;
      
      if (data.success === true || data.token || data.access_token) {
        const user = data.user || data.data?.user || data.data || data;
        const token = data.token || data.access_token;
        
        if (!token) {
          throw new Error('No authentication token received');
        }

        localStorage.setItem('cashierToken', token);
        localStorage.setItem('cashierData', JSON.stringify(user));
        localStorage.setItem('userToken', token);
        localStorage.setItem('userData', JSON.stringify(user));
        localStorage.setItem('sessionToken', token);
        
        if (data.device) {
          localStorage.setItem('deviceId', data.device.deviceId || data.device.id);
        }
        
        cache.clearAll();
        
        console.log('✅ Cashier login successful:', {
          user: { id: user._id || user.id, email: user.email, role: user.role },
          tokenReceived: !!token,
          endpointUsed: usedEndpoint
        });
        
        return {
          success: true,
          user: user,
          token: token,
          device: data.device,
          sessionId: data.sessionId,
          sessionTimeout: data.sessionTimeout || 5,
          message: data.message || 'Login successful'
        };
      } else {
        throw new Error(data.message || 'Login failed: Invalid response structure');
      }
    } catch (error) {
      console.error('❌ Cashier login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      localStorage.removeItem('cashierToken');
      localStorage.removeItem('cashierData');
      
      let errorMessage = handleApiError(error);
      
      if (error.response?.status === 404) {
        errorMessage = 'Login service unavailable. Please contact administrator.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (error.message.includes('All login endpoints failed')) {
        errorMessage = 'Cannot connect to authentication service. Please check if the server is running.';
      }
      
      throw new Error(errorMessage);
    }
  },

  // ==================== SECURE CODE LOGIN ====================
  
  requestSecureCode: async (emailData) => {
    try {
      const fastInstance = createApiInstance(API_CONFIG.baseURL, 8000);
      const response = await fastInstance.post('/auth/request-code', emailData);
      return response.data;
    } catch (error) {
      console.error('❌ Secure code request error:', error);
      throw new Error(handleApiError(error));
    }
  },

  verifySecureCode: async (codeData) => {
    try {
      console.log('🔐 Verifying secure code for:', codeData.email);
      
      const fastInstance = createApiInstance(API_CONFIG.baseURL, 8000);
      const response = await fastInstance.post('/auth/verify-code', codeData);
      
      console.log('✅ Verification response received:', response.data);
      
      const data = response.data;
      
      if (!data.success) {
        throw new Error(data.message || 'Verification failed');
      }
      
      const user = data.user || data.data?.user || data.data;
      
      if (!user) {
        console.error('❌ No user data in response:', data);
        throw new Error('No user data received from server');
      }
      
      console.log('👤 User data extracted:', {
        id: user._id || user.id,
        email: user.email,
        role: user.role,
        name: user.name
      });
      
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('sessionToken', data.token);
        
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        quickApi.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        fastApi.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      }
      
      if (user.role === 'admin') {
        localStorage.setItem('adminData', JSON.stringify(user));
        localStorage.setItem('userData', JSON.stringify(user));
        console.log('✅ Admin data stored');
      } else if (user.role === 'cashier') {
        localStorage.setItem('cashierData', JSON.stringify(user));
        localStorage.setItem('userData', JSON.stringify(user));
        console.log('✅ Cashier data stored');
      } else {
        localStorage.setItem('userData', JSON.stringify(user));
        console.log('✅ User data stored');
      }
      
      if (data.device) {
        localStorage.setItem('deviceId', data.device.deviceId || data.device.id);
      }
      
      cache.clearAll();
      
      console.log(`✅ ${user.role || 'User'} login successful`);
      return data;
    } catch (error) {
      console.error('❌ Secure code verification error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Verification failed. ';
      
      if (error.response?.status === 404) {
        errorMessage = 'Invalid email or code. Please try again.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid verification code. Please try again.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your connection.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred';
      }
      
      throw new Error(errorMessage);
    }
  },

  // ==================== DEVICE VERIFICATION ====================
  
  checkDevice: async (data) => {
    try {
      console.log('📱 Checking device for:', data.email);
      
      // Make sure deviceInfo is included
      if (!data.deviceInfo) {
        throw new Error('Device information is required');
      }
      
      const response = await fastApi.post('/auth/check-device', data);
      console.log('📱 Device check response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Device check error:', error);
      
      // If the response has requiresVerification, return it
      if (error.response?.data?.requiresVerification) {
        return error.response.data;
      }
      
      throw new Error(handleApiError(error));
    }
  },

  // ==================== SESSION MANAGEMENT ====================
  
  refreshSession: async () => {
    try {
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
      if (!token) throw new Error('No session token');
      
      const response = await fastApi.post('/auth/refresh-session', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Session refresh error:', error);
      throw new Error(handleApiError(error));
    }
  },

  logout: async (token) => {
    try {
      const authToken = token || localStorage.getItem('sessionToken') || 
                        localStorage.getItem('cashierToken') || 
                        localStorage.getItem('adminToken');
      if (authToken) {
        await fastApi.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
    } finally {
      localStorage.removeItem('cashierData');
      localStorage.removeItem('cashierToken');
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('deviceId');
      localStorage.removeItem('userData');
      localStorage.removeItem('userToken');
      localStorage.removeItem('adminData');
      localStorage.removeItem('adminToken');
      cache.clearAll();
      console.log('✅ Logout completed - all user data cleared');
    }
  },

  // ==================== DEVICE MANAGEMENT ====================
  
  getDevices: async () => {
    try {
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
      if (!token) throw new Error('No session token');
      
      const response = await fastApi.get('/auth/devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching devices:', error);
      throw new Error(handleApiError(error));
    }
  },

  revokeDevice: async (deviceId) => {
    try {
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
      if (!token) throw new Error('No session token');
      
      const response = await fastApi.delete(`/auth/devices/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error revoking device:', error);
      throw new Error(handleApiError(error));
    }
  },

  getSessions: async () => {
    try {
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
      if (!token) throw new Error('No session token');
      
      const response = await fastApi.get('/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching sessions:', error);
      throw new Error(handleApiError(error));
    }
  },

  // ==================== ADMIN VERIFICATION MANAGEMENT ====================
  
  getVerificationRequests: async () => {
    try {
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
      if (!token) throw new Error('No session token');
      
      const response = await fastApi.get('/admin/verification-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching verification requests:', error);
      throw new Error(handleApiError(error));
    }
  },

  verifyDevice: async (data) => {
    try {
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
      if (!token) throw new Error('No session token');
      
      const response = await fastApi.post('/admin/verify-device', data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error verifying device:', error);
      throw new Error(handleApiError(error));
    }
  },

  // ==================== UTILITY METHODS ====================
  
  isCashierLoggedIn: () => {
    const token = localStorage.getItem('cashierToken') || 
                  localStorage.getItem('userToken') || 
                  localStorage.getItem('sessionToken');
    const cashierData = localStorage.getItem('cashierData') || 
                       localStorage.getItem('userData');
    
    if (token && cashierData) {
      try {
        const user = JSON.parse(cashierData);
        return user.role === 'cashier';
      } catch (error) {
        return false;
      }
    }
    return false;
  },

  isAdminLoggedIn: () => {
    const token = localStorage.getItem('adminToken') || 
                  localStorage.getItem('userToken') || 
                  localStorage.getItem('sessionToken');
    const adminData = localStorage.getItem('adminData') || 
                     localStorage.getItem('userData');
    
    if (token && adminData) {
      try {
        const user = JSON.parse(adminData);
        return user.role === 'admin';
      } catch (error) {
        return false;
      }
    }
    return false;
  },

  getCurrentUser: () => {
    try {
      const userData = localStorage.getItem('userData') || 
                      localStorage.getItem('cashierData') || 
                      localStorage.getItem('adminData');
      if (userData) {
        return JSON.parse(userData);
      }
      return null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  },

  getCurrentCashier: () => {
    try {
      const cashierData = localStorage.getItem('cashierData') || 
                         localStorage.getItem('userData');
      if (cashierData) {
        const user = JSON.parse(cashierData);
        return user.role === 'cashier' ? user : null;
      }
      return null;
    } catch (error) {
      console.error('Error parsing cashier data:', error);
      return null;
    }
  },

  getCurrentAdmin: () => {
    try {
      const adminData = localStorage.getItem('adminData') || 
                       localStorage.getItem('userData');
      if (adminData) {
        const user = JSON.parse(adminData);
        return user.role === 'admin' ? user : null;
      }
      return null;
    } catch (error) {
      console.error('Error parsing admin data:', error);
      return null;
    }
  }
};

// ==================== OPTIMIZED TRANSACTION API SERVICE ====================

export const transactionAPI = {
  create: async (transactionData) => {
    try {
      console.log('💰 Creating transaction...');
      
      if (transactionData.isCreditPayment) {
        console.log('💳 Processing credit payment transaction');
        transactionData.transactionType = 'credit_payment';
        transactionData.paymentStatus = 'completed';
        
        if (transactionData.items && transactionData.items.length > 0) {
          transactionData.items = transactionData.items.map(item => ({
            ...item,
            productId: item.productId || null,
            productName: item.productName || `Credit Payment`,
            quantity: item.quantity || 1,
            price: item.price || transactionData.totalAmount,
            totalPrice: item.totalPrice || transactionData.totalAmount,
            buyingPrice: item.buyingPrice || 0
          }));
        }
      }

      const response = await quickApi.post('/transactions', transactionData);
      cache.clearAll();
      
      console.log('✅ Transaction created successfully');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error creating transaction:', error);
      
      let errorMessage = 'Transaction failed. ';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out. Please check your connection and try again.';
      } else if (error.response?.status === 500) {
        errorMessage += 'Server error. Please try again.';
      } else {
        errorMessage += handleApiError(error);
      }
      
      throw new Error(errorMessage);
    }
  },

  getAll: async (params = {}) => {
    try {
      const cacheKey = `transactions_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const response = await api.get('/transactions', { params });
      const data = response.data?.data || response.data;
      
      cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw new Error(handleApiError(error));
    }
  },

  getById: async (id) => {
    try {
      const transactionId = typeof id === 'object' ? id._id || id.id || id.transactionId : id;
      
      if (!transactionId) {
        throw new Error('Invalid transaction ID');
      }
      
      const response = await api.get(`/transactions/${transactionId}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/transactions/${id}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/transactions/${id}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw new Error(handleApiError(error));
    }
  }
};

// ==================== OPTIMIZED CREDIT API SERVICE ====================

export const creditAPI = {
  create: async (creditData) => {
    try {
      console.log('💳 Creating credit record...');
      
      if (!creditData.transactionId) {
        throw new Error('Transaction ID is required for credit record');
      }
      
      if (!creditData.customerName) {
        throw new Error('Customer name is required for credit record');
      }
      
      const response = await quickApi.post('/credits', creditData);
      cache.clearAll();
      console.log('✅ Credit record created successfully');
      return response.data;
    } catch (error) {
      console.error('❌ Error creating credit record:', error);
      
      let errorMessage = handleApiError(error);
      
      if (error.message.includes('Transaction ID')) {
        errorMessage = error.message;
      } else if (error.response?.status === 404) {
        errorMessage = 'Credit creation endpoint not found. Please check if the backend server is running.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid credit data provided';
      }
      
      throw new Error(errorMessage);
    }
  },

  getAll: async (params = {}) => {
    try {
      console.log('📋 Fetching credits...');
      
      const cacheKey = `credits_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached credits data');
        return cached;
      }

      const optimizedParams = {
        includeTransactions: 'false',
        status: params.status !== 'all' ? params.status : undefined,
        shopId: params.shopId !== 'all' ? params.shopId : undefined,
        limit: params.limit || 100,
        sort: '-createdAt',
        simple: 'true'
      };

      const response = await quickApi.get('/credits', { params: optimizedParams });
      
      console.log('✅ Credits fetched successfully');
      
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching credits:', error);
      throw new Error(handleApiError(error));
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/credits/${id}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching credit:', error);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id, updateData) => {
    try {
      const response = await api.put(`/credits/${id}`, updateData);
      cache.clearAll();
      return response.data;
    } catch (error) {
      console.error('❌ Error updating credit:', error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/credits/${id}`);
      cache.clearAll();
      return response.data;
    } catch (error) {
      console.error('❌ Error deleting credit:', error);
      throw new Error(handleApiError(error));
    }
  },

  patchPayment: async (id, paymentData) => {
    try {
      const response = await quickApi.patch(`/credits/${id}/payment`, paymentData);
      cache.clearAll();
      return response.data;
    } catch (error) {
      console.error('❌ Error recording payment:', error);
      throw new Error(handleApiError(error));
    }
  },

  getPaymentHistory: async (creditId) => {
    try {
      const response = await quickApi.get(`/credits/${creditId}/payment-history`);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching payment history:', error);
      throw new Error(handleApiError(error));
    }
  }
};

// ==================== ENHANCED UNIFIED API SERVICE ====================

export const unifiedAPI = {
  getCombinedTransactions: async (params = {}) => {
    try {
      console.log('🚀 Fetching enhanced combined transactions...', params);
      
      const cacheKey = `combined_transactions_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached combined transactions');
        return cached;
      }
      
      const response = await quickApi.get('/transactions/combined', { params });
      
      const data = response.data?.data || response.data;
      
      const transactions = data.transactions || 
                          data.salesWithProfit || 
                          data.filteredTransactions || 
                          data.comprehensiveData?.transactions || 
                          [];

      const expenses = data.expenses || data.comprehensiveData?.expenses || [];
      const credits = data.credits || data.comprehensiveData?.credits || [];
      const products = data.products || data.comprehensiveData?.products || [];
      const shops = data.shops || data.comprehensiveData?.shops || [];
      const cashiers = data.cashiers || data.comprehensiveData?.cashiers || [];

      const enhancedData = {
        transactions: transactions,
        salesWithProfit: transactions,
        filteredTransactions: transactions,
        expenses: expenses,
        credits: credits,
        products: products,
        shops: shops,
        cashiers: cashiers,
        summary: data.summary || CalculationUtils.getDefaultStats(),
        financialStats: data.financialStats || data.summary || CalculationUtils.getDefaultStats(),
        enhancedStats: data.enhancedStats || {
          salesWithProfit: transactions,
          financialStats: data.summary || data.financialStats || CalculationUtils.getDefaultStats()
        }
      };

      cache.set(cacheKey, enhancedData);
      console.log('✅ Combined transactions data received');
      return enhancedData;
    } catch (error) {
      console.error('❌ Error fetching combined transactions:', error);
      
      const fallbackData = {
        transactions: [],
        salesWithProfit: [],
        filteredTransactions: [],
        shops: [],
        cashiers: [],
        products: [],
        expenses: [],
        credits: [],
        summary: CalculationUtils.getDefaultStats(),
        financialStats: CalculationUtils.getDefaultStats(),
        enhancedStats: {
          salesWithProfit: [],
          financialStats: CalculationUtils.getDefaultStats()
        },
        error: handleApiError(error)
      };
      
      return fallbackData;
    }
  },

  createTransaction: async (transactionData) => {
    try {
      console.log('💰 Creating transaction...');
      
      if (transactionData.paymentMethod === 'credit') {
        transactionData.amountPaidNow = transactionData.amountPaid;
      }

      const response = await quickApi.post('/transactions', transactionData);
      cache.clearAll();
      
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error creating transaction:', error);
      throw new Error(handleApiError(error));
    }
  },

  getCombinedReports: async (params = {}) => {
    try {
      console.log('📊 Generating combined reports...');
      
      const cacheKey = `combined_reports_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      const transactionsData = await unifiedAPI.getCombinedTransactions(params);
      
      const enhancedReports = {
        ...transactionsData,
        salesSummary: transactionsData.salesSummary || {
          financialStats: transactionsData.financialStats,
          topProducts: transactionsData.performance?.topProducts || [],
          topCashiers: transactionsData.performance?.topCashiers || []
        },
        comprehensiveReport: transactionsData.comprehensiveReport || {
          summary: transactionsData.financialStats,
          transactions: transactionsData.transactions,
          expenses: transactionsData.expenses,
          products: transactionsData.products,
          credits: transactionsData.credits
        }
      };
      
      cache.set(cacheKey, enhancedReports);
      return enhancedReports;
    } catch (error) {
      console.error('❌ Error generating combined reports:', error);
      
      const cacheKey = `combined_reports_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      return {
        salesSummary: {
          financialStats: CalculationUtils.getDefaultStats(),
          topProducts: [],
          topCashiers: []
        },
        comprehensiveReport: {
          summary: CalculationUtils.getDefaultStats(),
          transactions: [],
          expenses: [],
          products: [],
          credits: []
        },
        error: handleApiError(error)
      };
    }
  },

  getCombinedCreditAnalysis: async (params = {}) => {
    try {
      console.log('💳 Fetching combined credit analysis...');
      
      const cacheKey = `credit_analysis_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      const transactionsData = await unifiedAPI.getCombinedTransactions(params);
      
      const creditTransactions = transactionsData.transactions?.filter(t => t.isCreditTransaction) || [];
      const credits = transactionsData.credits || [];
      
      const totalCreditSales = transactionsData.financialStats?.creditSales || 
                              creditTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      
      const recognizedCreditRevenue = transactionsData.financialStats?.recognizedCreditRevenue ||
                                    creditTransactions.reduce((sum, t) => sum + (t.recognizedRevenue || 0), 0);
      
      const outstandingCredit = transactionsData.financialStats?.outstandingCredit ||
                              creditTransactions.reduce((sum, t) => sum + (t.outstandingRevenue || 0), 0);
      
      const enhancedAnalysis = {
        totalCreditSales: parseFloat(totalCreditSales.toFixed(2)),
        outstandingCredit: parseFloat(outstandingCredit.toFixed(2)),
        recognizedCreditRevenue: parseFloat(recognizedCreditRevenue.toFixed(2)),
        creditSalesCount: Math.max(creditTransactions.length, credits.length),
        creditCollectionRate: totalCreditSales > 0 ? 
          parseFloat(((totalCreditSales - outstandingCredit) / totalCreditSales) * 100).toFixed(2) : 0
      };
      
      cache.set(cacheKey, enhancedAnalysis);
      return enhancedAnalysis;
    } catch (error) {
      console.error('❌ Error in credit analysis calculation:', error);
      
      const cacheKey = `credit_analysis_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      return {
        totalCreditSales: 0,
        outstandingCredit: 0,
        recognizedCreditRevenue: 0,
        creditSalesCount: 0,
        creditCollectionRate: 0,
        error: handleApiError(error)
      };
    }
  },

  getTransactionMetrics: async (params = {}) => {
    try {
      console.log('📈 Fetching transaction metrics...');
      
      const cacheKey = `transaction_metrics_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await quickApi.get('/transactions/metrics', { params });
      const metrics = response.data?.data || response.data;
      
      cache.set(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('❌ Error fetching transaction metrics:', error);
      
      return {
        totalSales: { amount: 0, count: 0, description: '0 transactions' },
        creditSales: { amount: 0, count: 0, description: '0 credit transactions' },
        nonCreditSales: { amount: 0, count: 0, description: '0 complete transactions' },
        totalRevenue: { amount: 0, description: 'From credit & non-credit sales' },
        expenses: { amount: 0, description: 'Total operational costs' },
        grossProfit: { amount: 0, description: 'Revenue - Cost of Goods' },
        netProfit: { amount: 0, description: 'After all expenses' },
        costOfGoodsSold: { amount: 0, description: 'For credit & non-credit sales' },
        totalMpesaBank: { amount: 0, description: 'Digital payments' },
        totalCash: { amount: 0, description: 'Cash payments' },
        outstandingCredit: { amount: 0, description: 'Unpaid credit balance' },
        totalCreditGiven: { amount: 0, description: 'Total credit extended' },
        error: handleApiError(error)
      };
    }
  },

  getCashierDashboardMetrics: async (params = {}) => {
    try {
      console.log('👤 Fetching cashier-specific dashboard metrics...');
      
      const cacheKey = `cashier_metrics_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await quickApi.get('/cashier/dashboard-metrics', { params });
      const metrics = response.data?.data || response.data;
      
      cache.set(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('❌ Error fetching cashier dashboard metrics:', error);
      
      return {
        totalSales: 0,
        totalTransactions: 0,
        creditSales: 0,
        nonCreditSales: 0,
        totalCash: 0,
        totalMpesaBank: 0,
        totalCredit: 0,
        outstandingCredit: 0,
        itemsSold: 0,
        averageTransaction: 0,
        profitMargin: 0,
        creditTransactions: 0,
        creditCollectionRate: 0,
        recognizedCreditRevenue: 0,
        immediateRevenue: 0,
        creditImmediateRevenue: 0,
        error: handleApiError(error)
      };
    }
  }
};

// ==================== OPTIMIZED BASIC CRUD APIs ====================

const createBasicAPI = (endpoint) => ({
  getAll: async (params = {}) => {
    try {
      console.log(`📋 Fetching ${endpoint}...`);
      
      const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fastApi.get(`/${endpoint}`, { params });
      const data = response.data?.data || response.data;
      const items = Array.isArray(data) ? data : [];

      cache.set(cacheKey, items);
      return items;
    } catch (error) {
      console.error(`❌ Error fetching ${endpoint}:`, error);
      
      const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      return cached || [];
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/${endpoint}/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error fetching ${endpoint}:`, error);
      throw new Error(handleApiError(error));
    }
  },

  create: async (data) => {
    try {
      const response = await quickApi.post(`/${endpoint}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error creating ${endpoint}:`, error);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/${endpoint}/${id}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error updating ${endpoint}:`, error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/${endpoint}/${id}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error deleting ${endpoint}:`, error);
      throw new Error(handleApiError(error));
    }
  }
});

export const productAPI = createBasicAPI('products');
export const shopAPI = createBasicAPI('shops');
export const cashierAPI = createBasicAPI('cashiers');

// Enhanced expense API
export const expenseAPI = {
  ...createBasicAPI('expenses'),
  
  getStats: async (params = {}) => {
    try {
      const response = await quickApi.get('/expenses/stats/overview', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching expense stats:', error);
      return {
        overview: { 
          totalExpenses: 0, 
          totalAmount: 0, 
          averageExpense: 0, 
          minExpense: 0, 
          maxExpense: 0,
          expensesCount: 0
        },
        byCategory: [],
        byPaymentMethod: [],
        byShop: [],
        recentExpenses: [],
        trends: {
          daily: [],
          weekly: [],
          monthly: []
        }
      };
    }
  },

  getByDateRange: async (startDate, endDate) => {
    try {
      const response = await quickApi.get('/expenses', {
        params: { startDate, endDate }
      });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching expenses by date range:', error);
      return [];
    }
  }
};

// ==================== OPTIMIZED REPORT API SERVICE ====================

export const reportAPI = {
  getDashboardData: async (filters = {}) => {
    try {
      console.log('📈 Fetching complete dashboard data...');
      
      const [transactionsData, creditAnalysis] = await Promise.all([
        unifiedAPI.getCombinedTransactions(filters),
        unifiedAPI.getCombinedCreditAnalysis(filters)
      ]);
      
      const dashboardData = {
        ...transactionsData,
        creditAnalysis,
        creditStats: creditAnalysis,
        loadedAt: new Date().toISOString(),
        dataSources: {
          transactions: transactionsData.transactions?.length || 0,
          shops: transactionsData.shops?.length || 0,
          cashiers: transactionsData.cashiers?.length || 0,
          products: transactionsData.products?.length || 0,
          credits: transactionsData.credits?.length || 0,
          expenses: transactionsData.expenses?.length || 0
        }
      };
      
      console.log('✅ Enhanced dashboard data loaded');
      return dashboardData;
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      
      try {
        const transactionsData = await unifiedAPI.getCombinedTransactions(filters);
        const creditAnalysis = await unifiedAPI.getCombinedCreditAnalysis(filters);
        
        return {
          ...transactionsData,
          creditAnalysis,
          creditStats: creditAnalysis,
          loadedAt: new Date().toISOString(),
          dataSources: {
            transactions: transactionsData.transactions?.length || 0,
            shops: transactionsData.shops?.length || 0,
            cashiers: transactionsData.cashiers?.length || 0,
            products: transactionsData.products?.length || 0,
            credits: transactionsData.credits?.length || 0,
            expenses: transactionsData.expenses?.length || 0
          },
          error: 'Partial data loaded due to server issues'
        };
      } catch (fallbackError) {
        throw new Error(handleApiError(error));
      }
    }
  },

  getCreditAnalysisReport: async (filters = {}) => {
    const analysis = await unifiedAPI.getCombinedCreditAnalysis(filters);
    return {
      ...analysis,
      reportGenerated: new Date().toISOString(),
      filters
    };
  },

  getCashierDashboard: async (filters = {}) => {
    try {
      console.log('👤 Fetching cashier dashboard data...');
      
      const [metrics, transactions] = await Promise.all([
        unifiedAPI.getCashierDashboardMetrics(filters),
        unifiedAPI.getCombinedTransactions(filters)
      ]);
      
      return {
        ...metrics,
        recentTransactions: transactions.transactions?.slice(0, 10) || [],
        loadedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error loading cashier dashboard data:', error);
      
      return {
        totalSales: 0,
        totalTransactions: 0,
        creditSales: 0,
        nonCreditSales: 0,
        totalCash: 0,
        totalMpesaBank: 0,
        totalCredit: 0,
        outstandingCredit: 0,
        recentTransactions: [],
        error: handleApiError(error)
      };
    }
  }
};

// ==================== CASHIER ANALYTICS API ====================

export const cashierAnalyticsAPI = {
  getCashierAnalytics: async (cashierId, params = {}) => {
    try {
      console.log('📊 Fetching cashier analytics...', { cashierId, params });
      
      const cacheKey = `cashier_analytics_${cashierId}_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await quickApi.get(`/cashiers/${cashierId}/analytics`, { params });
      const analyticsData = response.data?.data || response.data;
      
      cache.set(cacheKey, analyticsData);
      return analyticsData;
    } catch (error) {
      console.error('❌ Error fetching cashier analytics:', error);
      
      return {
        cashier: null,
        metrics: {
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          totalTransactions: 0,
          totalItemsSold: 0,
          profitMargin: 0,
          creditSalesCount: 0,
          totalCreditAmount: 0,
          outstandingCredit: 0,
          averageTransactionValue: 0,
          creditCollectionRate: 0
        },
        dailyPerformance: [],
        topProducts: [],
        credits: [],
        period: {
          start: new Date().toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0],
          timeRange: '7d'
        },
        error: handleApiError(error)
      };
    }
  },

  getCashierPerformance: async (cashierId, params = {}) => {
    try {
      const response = await quickApi.get(`/cashiers/${cashierId}/performance`, { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching cashier performance:', error);
      throw new Error(handleApiError(error));
    }
  },

  getCashierTransactions: async (cashierId, params = {}) => {
    try {
      const response = await quickApi.get(`/cashiers/${cashierId}/transactions`, { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching cashier transactions:', error);
      throw new Error(handleApiError(error));
    }
  },

  getCashierCredits: async (cashierId, params = {}) => {
    try {
      const response = await quickApi.get(`/cashiers/${cashierId}/credits`, { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching cashier credits:', error);
      throw new Error(handleApiError(error));
    }
  },

  getCashiersWithMetrics: async (params = {}) => {
    try {
      const response = await quickApi.get('/cashiers-with-metrics', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching cashiers with metrics:', error);
      throw new Error(handleApiError(error));
    }
  }
};

// ==================== MAIN API SERVICE ====================

const apiService = {
  unified: unifiedAPI,
  auth: authAPI,
  transactions: transactionAPI,
  products: productAPI,
  shops: shopAPI,
  cashiers: cashierAPI,
  expenses: expenseAPI,
  credits: creditAPI,
  reports: reportAPI,
  cashierAnalytics: cashierAnalyticsAPI,
  handleApiError,
  cache,
  clearCache: () => cache.clearAll(),
  getCacheStats: () => ({
    size: Object.keys(cache.data).length,
    keys: Object.keys(cache.data)
  })
};

export default apiService;
export { handleApiError };