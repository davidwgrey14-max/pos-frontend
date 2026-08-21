// src/services/api.js - COMPLETE WITH SECURITY FEATURES (CLEAN VERSION)
import axios from 'axios';

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
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('authToken') ||
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
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
      
      // Handle session expiry
      if (error.response?.status === 401) {
        const message = error.response?.data?.message || '';
        if (message.includes('SESSION_EXPIRED') || message.includes('session expired')) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('cashierToken');
          localStorage.removeItem('adminToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('cashierData');
          localStorage.removeItem('adminData');
          localStorage.removeItem('deviceVerified');
          
          // Dispatch session expired event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sessionExpired'));
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
        localStorage.setItem('authToken', token);
        
        if (data.device) {
          localStorage.setItem('deviceId', data.device.deviceId || data.device.id);
          localStorage.setItem('deviceVerified', 'true');
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

  // In authAPI object, add after cashierLogin:

managerLogin: async (credentials) => {
  try {
    console.log('🔐 Attempting manager login...');
    
    
    let response;
    const loginAttempts = [
      '/auth/manager/login',
      '/manager/login',
      '/auth/login'
    ];

    for (const endpoint of loginAttempts) {
      try {
        const fastInstance = createApiInstance(API_CONFIG.baseURL, 8000);
        response = await fastInstance.post(endpoint, {
          email: credentials.email,
          password: credentials.password,
          role: 'manager',
          deviceId: credentials.deviceId || localStorage.getItem('deviceId')
        });
        break;
      } catch (endpointError) {
        continue;
      }
    }

    if (!response) {
      throw new Error('All login endpoints failed');
    }

    const data = response.data;
    
    if (data.success === true || data.token || data.access_token) {
      const user = data.user || data.data?.user || data.data || data;
      const token = data.token || data.access_token;
      
      localStorage.setItem('managerToken', token);
      localStorage.setItem('managerData', JSON.stringify(user));
      localStorage.setItem('userToken', token);
      localStorage.setItem('userData', JSON.stringify(user));
      localStorage.setItem('sessionToken', token);
      localStorage.setItem('authToken', token);
      
      return { success: true, user, token, device: data.device };
    } else {
      throw new Error(data.message || 'Login failed');
    }
  } catch (error) {
    console.error('Manager login error:', error);
    throw new Error(error.message || 'Login failed');
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
        localStorage.setItem('authToken', data.token);
        
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        quickApi.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        fastApi.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      }
      
      // In authAPI.verifySecureCode, after the user data extraction:
if (user.role === 'admin') {
  localStorage.setItem('adminData', JSON.stringify(user));
  localStorage.setItem('userData', JSON.stringify(user));
} else if (user.role === 'manager') {
  localStorage.setItem('managerData', JSON.stringify(user));
  localStorage.setItem('userData', JSON.stringify(user));
} else if (user.role === 'cashier') {
  localStorage.setItem('cashierData', JSON.stringify(user));
  localStorage.setItem('userData', JSON.stringify(user));
}
      
      if (data.device) {
        localStorage.setItem('deviceId', data.device.deviceId || data.device.id);
        localStorage.setItem('deviceVerified', 'true');
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
      
      if (!data.deviceInfo) {
        throw new Error('Device information is required');
      }
      
      const response = await fastApi.post('/auth/check-device', data);
      console.log('📱 Device check response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Device check error:', error);
      
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
                    localStorage.getItem('authToken') ||
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
                        localStorage.getItem('authToken') ||
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
      localStorage.removeItem('authToken');
      localStorage.removeItem('deviceId');
      localStorage.removeItem('deviceVerified');
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
                    localStorage.getItem('authToken') ||
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
                    localStorage.getItem('authToken') ||
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
                    localStorage.getItem('authToken') ||
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
                    localStorage.getItem('authToken') ||
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
                    localStorage.getItem('authToken') ||
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
                  localStorage.getItem('sessionToken') ||
                  localStorage.getItem('authToken');
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
                  localStorage.getItem('sessionToken') ||
                  localStorage.getItem('authToken');
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

// ==================== UNIFIED API SERVICE ====================

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
        summary: data.summary || getDefaultStats(),
        financialStats: data.financialStats || data.summary || getDefaultStats(),
        enhancedStats: data.enhancedStats || {
          salesWithProfit: transactions,
          financialStats: data.summary || data.financialStats || getDefaultStats()
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
        summary: getDefaultStats(),
        financialStats: getDefaultStats(),
        enhancedStats: {
          salesWithProfit: [],
          financialStats: getDefaultStats()
        },
        error: handleApiError(error)
      };
      
      return fallbackData;
    }
  }
};

// ==================== BASIC API HELPERS ====================

const getDefaultStats = () => ({
  totalRevenue: 0,
  totalSales: 0,
  creditSales: 0,
  nonCreditSales: 0,
  totalExpenses: 0,
  netProfit: 0,
  grossProfit: 0,
  costOfGoodsSold: 0,
  totalCash: 0,
  totalMpesaBank: 0,
  outstandingCredit: 0,
  totalCreditGiven: 0,
  creditSalesCount: 0,
  nonCreditSalesCount: 0,
  totalItemsSold: 0,
  profitMargin: 0,
  creditCollectionRate: 0
});

// ==================== CREDIT API ====================

export const creditAPI = {
  getAll: async (params = {}) => {
    try {
      console.log('📋 Fetching credits...');
      
      const response = await api.get('/credits', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('❌ Error fetching credits:', error);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/credits/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching credit:', error);
      throw new Error(handleApiError(error));
    }
  },

  create: async (data) => {
    try {
      const response = await api.post('/credits', data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error creating credit:', error);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/credits/${id}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error updating credit:', error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/credits/${id}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error deleting credit:', error);
      throw new Error(handleApiError(error));
    }
  },

  getStats: async (params = {}) => {
    try {
      const response = await api.get('/credits/stats', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching credit stats:', error);
      return {
        totalCredits: 0,
        totalAmount: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        overdueCount: 0
      };
    }
  },

  recordPayment: async (id, paymentData) => {
    try {
      const response = await api.post(`/credits/${id}/payments`, paymentData);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error recording payment:', error);
      throw new Error(handleApiError(error));
    }
  },

  getPaymentHistory: async (id) => {
    try {
      const response = await api.get(`/credits/${id}/payments`);
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('❌ Error fetching payment history:', error);
      return [];
    }
  }
};

// ==================== SHOP API ====================

export const shopAPI = {
  getAll: async (params = {}) => {
    try {
      const response = await fastApi.get('/shops', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error fetching shops:', error);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/shops/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching shop:', error);
      throw new Error(handleApiError(error));
    }
  },

  create: async (data) => {
    try {
      const response = await api.post('/shops', data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating shop:', error);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/shops/${id}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating shop:', error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/shops/${id}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error deleting shop:', error);
      throw new Error(handleApiError(error));
    }
  }
};

// ==================== PRODUCT API ====================

export const productAPI = {
  getAll: async (params = {}) => {
    try {
      const response = await fastApi.get('/products', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/products/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw new Error(handleApiError(error));
    }
  },

  create: async (data) => {
    try {
      const response = await api.post('/products', data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/products/${id}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/products/${id}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw new Error(handleApiError(error));
    }
  }
};

// ==================== CASHIER API ====================

export const cashierAPI = {
  getAll: async (params = {}) => {
    try {
      const response = await fastApi.get('/cashiers', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error fetching cashiers:', error);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/cashiers/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching cashier:', error);
      throw new Error(handleApiError(error));
    }
  },

  create: async (data) => {
    try {
      const response = await api.post('/cashiers', data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating cashier:', error);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/cashiers/${id}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating cashier:', error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/cashiers/${id}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error deleting cashier:', error);
      throw new Error(handleApiError(error));
    }
  }
};

// ==================== EXPENSE API ====================

export const expenseAPI = {
  getAll: async (params = {}) => {
    try {
      const response = await fastApi.get('/expenses', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error fetching expenses:', error);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/expenses/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching expense:', error);
      throw new Error(handleApiError(error));
    }
  },

  create: async (data) => {
    try {
      const response = await api.post('/expenses', data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw new Error(handleApiError(error));
    }
  },

  update: async (id, data) => {
    try {
      const response = await api.put(`/expenses/${id}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw new Error(handleApiError(error));
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/expenses/${id}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw new Error(handleApiError(error));
    }
  },

  getStats: async (params = {}) => {
    try {
      const response = await api.get('/expenses/stats', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching expense stats:', error);
      return {
        totalExpenses: 0,
        totalAmount: 0,
        averageExpense: 0,
        minExpense: 0,
        maxExpense: 0,
        expensesCount: 0
      };
    }
  }
};

// ==================== TRANSACTION API ====================

export const transactionAPI = {
  getAll: async (params = {}) => {
    try {
      const response = await fastApi.get('/transactions', { params });
      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  },

  getById: async (id) => {
    try {
      const response = await api.get(`/transactions/${id}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw new Error(handleApiError(error));
    }
  },

  create: async (data) => {
    try {
      const response = await api.post('/transactions', data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error(handleApiError(error));
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
  },

  getMetrics: async (params = {}) => {
    try {
      const response = await api.get('/transactions/metrics', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching transaction metrics:', error);
      return getDefaultStats();
    }
  }
};
// ==================== ADMIN API ====================

export const adminAPI = {
  // Admin-specific endpoints
  getVerificationRequests: authAPI.getVerificationRequests,
  verifyDevice: authAPI.verifyDevice,
  
  getDashboardStats: async (params = {}) => {
    try {
      const response = await api.get('/admin/dashboard/stats', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching admin dashboard stats:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  getUsers: async (params = {}) => {
    try {
      const response = await api.get('/admin/users', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  getUserById: async (userId) => {
    try {
      const response = await api.get(`/admin/users/${userId}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  updateUser: async (userId, data) => {
    try {
      const response = await api.put(`/admin/users/${userId}`, data);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  deleteUser: async (userId) => {
    try {
      const response = await api.delete(`/admin/users/${userId}`);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  getSystemSettings: async () => {
    try {
      const response = await api.get('/admin/settings');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching system settings:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  updateSystemSettings: async (settings) => {
    try {
      const response = await api.put('/admin/settings', settings);
      cache.clearAll();
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error updating system settings:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  getActivityLogs: async (params = {}) => {
    try {
      const response = await api.get('/admin/activity-logs', { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching activity logs:', error);
      throw new Error(handleApiError(error));
    }
  },
  
  getSystemHealth: async () => {
    try {
      const response = await api.get('/admin/health');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching system health:', error);
      throw new Error(handleApiError(error));
    }
  }
};

// ==================== EXPORT MAIN API SERVICE ====================

const apiService = {
  auth: authAPI,
  unified: unifiedAPI,
  shop: shopAPI,
  product: productAPI,
  cashier: cashierAPI,
  expense: expenseAPI,
  transaction: transactionAPI,
  credit: creditAPI,
  admin: adminAPI,
  cache,
  clearCache: () => cache.clearAll(),
  handleApiError,
  // Add missing utils object
  utils: {
    validateToken: (userType) => {
      try {
        const tokenKey = userType === 'cashier' ? 'cashierToken' : 
                         userType === 'manager' ? 'managerToken' : 'adminToken';
        const token = localStorage.getItem(tokenKey) || localStorage.getItem('authToken');
        if (!token) return false;
        // Simple token validation (check it's not expired)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.exp && Date.now() >= payload.exp * 1000) {
            return false;
          }
        }
        return true;
      } catch (error) {
        console.error('Token validation error:', error);
        return false;
      }
    },
    getAuthToken: (userType) => {
      const tokenKey = userType === 'cashier' ? 'cashierToken' : 
                       userType === 'manager' ? 'managerToken' : 'adminToken';
      return localStorage.getItem(tokenKey) || localStorage.getItem('authToken');
    },
    setAuthToken: (token, userType) => {
      const tokenKey = userType === 'cashier' ? 'cashierToken' : 
                       userType === 'manager' ? 'managerToken' : 'adminToken';
      localStorage.setItem(tokenKey, token);
      localStorage.setItem('authToken', token);
    },
    isAuthenticated: (userType) => {
      const tokenKey = userType === 'cashier' ? 'cashierToken' : 
                       userType === 'manager' ? 'managerToken' : 'adminToken';
      const userDataKey = userType === 'cashier' ? 'cashierData' : 
                         userType === 'manager' ? 'managerData' : 'adminData';
      const token = localStorage.getItem(tokenKey) || localStorage.getItem('authToken');
      const userData = localStorage.getItem(userDataKey) || localStorage.getItem('userData');
      return !!(token && userData && apiService.utils.validateToken(userType));
    },
    clearAuth: () => {
      localStorage.removeItem('cashierData');
      localStorage.removeItem('cashierToken');
      localStorage.removeItem('managerData');
      localStorage.removeItem('managerToken');
      localStorage.removeItem('adminData');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('authToken');
      localStorage.removeItem('deviceId');
      localStorage.removeItem('deviceVerified');
      localStorage.removeItem('userData');
      localStorage.removeItem('userToken');
      cache.clearAll();
    }
  }
};

export default apiService;