
// src/services/api.js - COMPLETELY UPDATED WITH PERFORMANCE OPTIMIZATIONS
import axios from 'axios';
import { CalculationUtils } from '../utils/calculationUtils';

// Enhanced Configuration
const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api',
  timeout: 15000, // Reduced from 30000 to 15000ms
  retryAttempts: 2,
  retryDelay: 1000,
  cacheTimeout: 60000 // 1 minute cache
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
  
  // Handle specific authentication errors
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
    
    // Clear expired entries
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

  // Cleanup every 5 minutes
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

  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('userToken') || localStorage.getItem('cashierToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Add cache busting for GET requests
      if (config.method === 'get') {
        config.params = {
          ...config.params,
          _t: Date.now() // Cache buster
        };
      }
      
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, config.params);
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor with enhanced retry logic
  instance.interceptors.response.use(
    (response) => {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - Success`);
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      
      // Retry logic for timeout and network errors
      if ((error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR') && 
          !originalRequest._retryCount) {
        
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        if (originalRequest._retryCount <= API_CONFIG.retryAttempts) {
          console.log(`🔄 Retry attempt ${originalRequest._retryCount} for: ${originalRequest.url}`);
          
          // Exponential backoff
          const delay = API_CONFIG.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return instance(originalRequest);
        }
      }
      
      if (error.response?.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('userToken');
        localStorage.removeItem('cashierToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('adminData');
        localStorage.removeItem('cashierData');
        if (typeof window !== 'undefined') {
          window.location.href = '/cashier/login';
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
const api = createApiInstance(); // Default 15s timeout
const quickApi = createApiInstance(API_CONFIG.baseURL, 10000); // 10s timeout for critical operations
const fastApi = createApiInstance(API_CONFIG.baseURL, 5000); // 5s timeout for simple operations

// ==================== ENHANCED AUTH API SERVICE ====================

export const authAPI = {
  // Cashier login with optimized timeout
  cashierLogin: async (credentials) => {
    try {
      console.log('🔐 Attempting cashier login with optimized timeout...');

      // Clear any existing tokens and data first
      localStorage.removeItem('cashierToken');
      localStorage.removeItem('cashierData');
      localStorage.removeItem('userToken');
      localStorage.removeItem('userData');

      let response;
      let usedEndpoint = '';
      
      // Try multiple possible login endpoints with fast timeout
      const loginAttempts = [
        '/auth/cashier/login',
        '/cashier/login',
        '/auth/login'
      ];

      for (const endpoint of loginAttempts) {
        try {
          console.log(`🔄 Trying login endpoint: ${endpoint}`);
          const fastInstance = createApiInstance(API_CONFIG.baseURL, 8000); // 8s timeout for login
          response = await fastInstance.post(endpoint, {
            email: credentials.email,
            password: credentials.password,
            role: 'cashier'
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

        // Store token and user data
        localStorage.setItem('cashierToken', token);
        localStorage.setItem('cashierData', JSON.stringify(user));
        localStorage.setItem('userToken', token);
        localStorage.setItem('userData', JSON.stringify(user));
        
        cache.clearAll();
        
        console.log('✅ Cashier login successful:', {
          user: { id: user.id, email: user.email, role: user.role },
          tokenReceived: !!token,
          endpointUsed: usedEndpoint
        });
        
        return {
          success: true,
          user: user,
          token: token,
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
      
      // Clear any partial data on error
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

  // Admin/secure code login with optimized timeout
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
// In api.js - replace the verifySecureCode function
verifySecureCode: async (codeData) => {
  try {
    console.log('🔐 Verifying secure code for:', codeData.email);
    
    const fastInstance = createApiInstance(API_CONFIG.baseURL, 8000);
    const response = await fastInstance.post('/auth/verify-code', codeData);
    
    console.log('✅ Verification response received:', response.data);
    
    const data = response.data;
    
    // Check if verification was successful
    if (!data.success) {
      throw new Error(data.message || 'Verification failed');
    }
    
    // Extract user data - the server returns user directly
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
    
    // Store token if available
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userToken', data.token);
      
      // Set authorization header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      quickApi.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      fastApi.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    }
    
    // Store user data based on role
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
    
    // Clear cache to refresh data
    cache.clearAll();
    
    console.log(`✅ ${user.role || 'User'} login successful`);
    return data; // Return the full response data
  } catch (error) {
    console.error('❌ Secure code verification error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Enhanced error message
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

  logout: () => {
    localStorage.removeItem('userData');
    localStorage.removeItem('adminData');
    localStorage.removeItem('cashierData');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('userToken');
    localStorage.removeItem('cashierToken');
    cache.clearAll();
    console.log('✅ Logout completed - all user data cleared');
  },

  // Utility function to check if cashier is logged in
  isCashierLoggedIn: () => {
    const token = localStorage.getItem('cashierToken') || localStorage.getItem('userToken');
    const cashierData = localStorage.getItem('cashierData') || localStorage.getItem('userData');
    
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

  // Get current cashier data
  getCurrentCashier: () => {
    try {
      const cashierData = localStorage.getItem('cashierData') || localStorage.getItem('userData');
      if (cashierData) {
        const user = JSON.parse(cashierData);
        return user.role === 'cashier' ? user : null;
      }
      return null;
    } catch (error) {
      console.error('Error parsing cashier data:', error);
      return null;
    }
  }
};

// ==================== OPTIMIZED TRANSACTION API SERVICE ====================

export const transactionAPI = {
  // Optimized transaction creation with faster timeout
  create: async (transactionData) => {
    try {
      console.log('💰 Creating transaction with optimized timeout...');
      
      // SPECIAL HANDLING FOR CREDIT PAYMENTS
      if (transactionData.isCreditPayment) {
        console.log('💳 Processing credit payment transaction');
        transactionData.transactionType = 'credit_payment';
        transactionData.paymentStatus = 'completed';
        
        // Ensure items array is properly formatted
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

      // Use quick API for faster response
      const response = await quickApi.post('/transactions', transactionData);
      cache.clearAll();
      
      console.log('✅ Transaction created successfully');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error creating transaction:', error);
      
      // Enhanced error handling with specific messages
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
      // Handle case where id might be an object instead of string
      const transactionId = typeof id === 'object' ? id._id || id.id || id.transactionId : id;
      
      if (!transactionId) {
        throw new Error('Invalid transaction ID');
      }
      
      const response = await api.get(`/transactions/${transactionId}`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      // Don't throw error for transaction details to prevent breaking the credits list
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
  // Basic CRUD operations with optimized timeouts
  create: async (creditData) => {
    try {
      console.log('💳 Creating credit record with optimized timeout...');
      
      // Ensure we have the required fields
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
      
      // Enhanced error handling
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

  // Optimized credit fetching with faster timeout and simplified response
  getAll: async (params = {}) => {
    try {
      console.log('📋 Fetching credits with optimized timeout...');
      
      const cacheKey = `credits_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached credits data');
        return cached;
      }

      // Use simplified parameters for faster response
      const optimizedParams = {
        includeTransactions: 'false', // Don't load transaction details initially
        status: params.status !== 'all' ? params.status : undefined,
        shopId: params.shopId !== 'all' ? params.shopId : undefined,
        limit: params.limit || 100, // Reduced limit for performance
        sort: '-createdAt',
        simple: 'true' // Request simplified response
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

  // Payment operations with optimized timeout
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
  // Optimized combined transactions with faster timeout
  getCombinedTransactions: async (params = {}) => {
    try {
      console.log('🚀 Fetching enhanced combined transactions with optimized timeout...', params);
      
      const cacheKey = `combined_transactions_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached combined transactions');
        return cached;
      }
      
      const response = await quickApi.get('/transactions/combined', { params });
      
      const data = response.data?.data || response.data;
      
      console.log('📊 Raw API Response Structure:', {
        hasSummary: !!data.summary,
        hasFinancialStats: !!data.financialStats,
        transactionsCount: data.transactions?.length || data.salesWithProfit?.length || 0
      });

      // Extract transactions from various possible locations in the response
      const transactions = data.transactions || 
                          data.salesWithProfit || 
                          data.filteredTransactions || 
                          data.comprehensiveData?.transactions || 
                          [];

      // Extract other data with proper fallbacks
      const expenses = data.expenses || data.comprehensiveData?.expenses || [];
      const credits = data.credits || data.comprehensiveData?.credits || [];
      const products = data.products || data.comprehensiveData?.products || [];
      const shops = data.shops || data.comprehensiveData?.shops || [];
      const cashiers = data.cashiers || data.comprehensiveData?.cashiers || [];

      // ENHANCED: Normalize credit data for consistency
      const normalizedCredits = credits.map(credit => ({
        ...credit,
        // Ensure consistent field names and calculations
        totalAmount: CalculationUtils.safeNumber(credit.totalAmount),
        amountPaid: CalculationUtils.safeNumber(credit.amountPaid),
        balanceDue: CalculationUtils.safeNumber(credit.balanceDue) || 
                   Math.max(0, CalculationUtils.safeNumber(credit.totalAmount) - CalculationUtils.safeNumber(credit.amountPaid)),
        // Normalize status
        status: credit.status || 'pending',
        // Ensure consistent customer information
        customerName: credit.customerName || 'Unknown Customer',
        customerPhone: credit.customerPhone || '',
        // Normalize shop information
        shopName: credit.shopName || (credit.shop && typeof credit.shop === 'object' ? credit.shop.name : 'Unknown Shop'),
        shopId: credit.shopId || (credit.shop && typeof credit.shop === 'object' ? credit.shop._id : null),
        // Normalize cashier information
        cashierName: credit.cashierName || 'Unknown Cashier',
        cashierId: credit.cashierId || null
      }));

      // ENHANCED: Normalize transaction data for consistency
      const normalizedTransactions = transactions.map(transaction => {
        const isCredit = transaction.paymentMethod === 'credit' || 
                        transaction.isCreditTransaction === true ||
                        transaction.status === 'credit';
        
        // Calculate consistent credit metrics
        const totalAmount = CalculationUtils.safeNumber(transaction.totalAmount);
        const amountPaid = CalculationUtils.safeNumber(transaction.amountPaid);
        const recognizedRevenue = CalculationUtils.safeNumber(transaction.recognizedRevenue);
        const outstandingRevenue = CalculationUtils.safeNumber(transaction.outstandingRevenue);
        
        let normalizedCreditData = {};
        
        if (isCredit) {
          // Ensure consistent credit calculations
          const calculatedAmountPaid = amountPaid || recognizedRevenue || 0;
          const calculatedOutstanding = outstandingRevenue || Math.max(0, totalAmount - calculatedAmountPaid);
          const calculatedRecognized = recognizedRevenue || calculatedAmountPaid;
          
          // Calculate credit status
          let creditStatus = transaction.creditStatus;
          if (!creditStatus) {
            if (calculatedOutstanding <= 0) {
              creditStatus = 'paid';
            } else if (calculatedAmountPaid > 0) {
              creditStatus = 'partially_paid';
            } else {
              creditStatus = 'pending';
            }
            
            // Check if overdue
            if (transaction.dueDate && new Date(transaction.dueDate) < new Date() && calculatedOutstanding > 0) {
              creditStatus = 'overdue';
            }
          }
          
          normalizedCreditData = {
            isCreditTransaction: true,
            amountPaid: calculatedAmountPaid,
            recognizedRevenue: calculatedRecognized,
            outstandingRevenue: calculatedOutstanding,
            creditStatus: creditStatus,
            collectionRate: totalAmount > 0 ? (calculatedRecognized / totalAmount) * 100 : 0
          };
        } else {
          normalizedCreditData = {
            isCreditTransaction: false,
            amountPaid: totalAmount,
            recognizedRevenue: totalAmount,
            outstandingRevenue: 0,
            creditStatus: null,
            collectionRate: 100
          };
        }
        
        return {
          ...transaction,
          // Normalize core financial data
          totalAmount: totalAmount,
          cost: CalculationUtils.safeNumber(transaction.cost),
          profit: CalculationUtils.safeNumber(transaction.profit),
          profitMargin: CalculationUtils.safeNumber(transaction.profitMargin),
          // Add normalized credit data
          ...normalizedCreditData,
          // Normalize display data
          displayDate: transaction.displayDate || 
                      new Date(transaction.saleDate || transaction.createdAt).toLocaleString('en-KE'),
          // Normalize shop information
          shopName: transaction.shopName || 
                   (transaction.shop && typeof transaction.shop === 'object' ? transaction.shop.name : 'Unknown Shop'),
          // Normalize cashier information
          cashierName: transaction.cashierName || 'Unknown Cashier'
        };
      });

      console.log('📈 Normalized data counts:', {
        transactions: normalizedTransactions.length,
        creditTransactions: normalizedTransactions.filter(t => t.isCreditTransaction).length,
        expenses: expenses.length,
        credits: normalizedCredits.length
      });

      // Enhanced data structure with consistent calculations
      const enhancedData = {
        // Core normalized data arrays
        transactions: normalizedTransactions,
        salesWithProfit: normalizedTransactions,
        filteredTransactions: normalizedTransactions,
        expenses: expenses,
        credits: normalizedCredits,
        products: products,
        shops: shops,
        cashiers: cashiers,
        
        // Enhanced statistics and summaries
        summary: data.summary || CalculationUtils.getDefaultStats(),
        financialStats: data.financialStats || data.summary || CalculationUtils.getDefaultStats(),
        enhancedStats: data.enhancedStats || {
          salesWithProfit: normalizedTransactions,
          financialStats: data.summary || data.financialStats || CalculationUtils.getDefaultStats()
        }
      };

      cache.set(cacheKey, enhancedData);
      console.log('✅ Combined transactions data received and enhanced');
      return enhancedData;
    } catch (error) {
      console.error('❌ Error fetching combined transactions:', error);
      
      // Return comprehensive fallback data with proper structure
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
      
      console.log('🔄 Returning fallback data structure');
      return fallbackData;
    }
  },

  // Optimized transaction creation
  createTransaction: async (transactionData) => {
    try {
      console.log('💰 Creating transaction with stock reduction and credit partial payment support...');
      
      // Add amountPaidNow for credit transactions to align with server expectations
      if (transactionData.paymentMethod === 'credit') {
        transactionData.amountPaidNow = transactionData.amountPaid;
        console.log('💳 Credit transaction - setting amountPaidNow:', transactionData.amountPaidNow);
      }

      const response = await quickApi.post('/transactions', transactionData);
      cache.clearAll();
      
      console.log('✅ Transaction created successfully with stock reduction and credit support');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error creating transaction:', error);
      throw new Error(handleApiError(error));
    }
  },

  // Optimized combined reports
  getCombinedReports: async (params = {}) => {
    try {
      console.log('📊 Generating combined reports with optimized timeout...');
      
      const cacheKey = `combined_reports_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached combined reports');
        return cached;
      }
      
      // Use the normalized transactions data as base
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
      console.log('✅ Combined reports generated');
      return enhancedReports;
    } catch (error) {
      console.error('❌ Error generating combined reports:', error);
      
      const cacheKey = `combined_reports_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('🔄 Using stale cached reports due to error');
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

  // Optimized credit analysis
  getCombinedCreditAnalysis: async (params = {}) => {
    try {
      console.log('💳 Fetching combined credit analysis with optimized timeout...');
      
      const cacheKey = `credit_analysis_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached credit analysis');
        return cached;
      }
      
      // Get normalized data from unified endpoint
      const transactionsData = await unifiedAPI.getCombinedTransactions(params);
      
      // Use the already normalized data
      const creditTransactions = transactionsData.transactions?.filter(t => t.isCreditTransaction) || [];
      const credits = transactionsData.credits || [];
      
      // Calculate metrics using normalized data
      const totalCreditSales = transactionsData.financialStats?.creditSales || 
                              creditTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      
      const recognizedCreditRevenue = transactionsData.financialStats?.recognizedCreditRevenue ||
                                    creditTransactions.reduce((sum, t) => sum + (t.recognizedRevenue || 0), 0);
      
      const outstandingCredit = transactionsData.financialStats?.outstandingCredit ||
                              creditTransactions.reduce((sum, t) => sum + (t.outstandingRevenue || 0), 0);
      
      // Enhanced credit analysis structure with consistent data
      const enhancedAnalysis = {
        // Core metrics using normalized data
        totalCreditSales: parseFloat(totalCreditSales.toFixed(2)),
        outstandingCredit: parseFloat(outstandingCredit.toFixed(2)),
        recognizedCreditRevenue: parseFloat(recognizedCreditRevenue.toFixed(2)),
        creditSalesCount: Math.max(creditTransactions.length, credits.length),
        creditCollectionRate: totalCreditSales > 0 ? 
          parseFloat(((totalCreditSales - outstandingCredit) / totalCreditSales) * 100).toFixed(2) : 0
      };
      
      cache.set(cacheKey, enhancedAnalysis);
      console.log('✅ Combined credit analysis calculated');
      return enhancedAnalysis;
    } catch (error) {
      console.error('❌ Error in credit analysis calculation:', error);
      
      const cacheKey = `credit_analysis_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('🔄 Using stale cached analysis due to error');
        return cached;
      }
      
      // Return comprehensive fallback data
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

  // Optimized transaction metrics
  getTransactionMetrics: async (params = {}) => {
    try {
      console.log('📈 Fetching specific transaction metrics with optimized timeout...');
      
      const cacheKey = `transaction_metrics_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached transaction metrics');
        return cached;
      }

      const response = await quickApi.get('/transactions/metrics', { params });
      const metrics = response.data?.data || response.data;
      
      cache.set(cacheKey, metrics);
      console.log('✅ Transaction metrics fetched successfully');
      return metrics;
    } catch (error) {
      console.error('❌ Error fetching transaction metrics:', error);
      
      // Return fallback metrics structure
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

  // Optimized cashier dashboard metrics
  getCashierDashboardMetrics: async (params = {}) => {
    try {
      console.log('👤 Fetching cashier-specific dashboard metrics with optimized timeout...');
      
      const cacheKey = `cashier_metrics_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached cashier metrics');
        return cached;
      }

      const response = await quickApi.get('/cashier/dashboard-metrics', { params });
      const metrics = response.data?.data || response.data;
      
      cache.set(cacheKey, metrics);
      console.log('✅ Cashier dashboard metrics fetched successfully');
      return metrics;
    } catch (error) {
      console.error('❌ Error fetching cashier dashboard metrics:', error);
      
      // Return fallback cashier metrics
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

// Generic factory for basic CRUD operations with optimized timeouts
const createBasicAPI = (endpoint) => ({
  getAll: async (params = {}) => {
    try {
      console.log(`📋 Fetching ${endpoint} with optimized timeout...`);
      
      const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(`✅ Using cached ${endpoint}`);
        return cached;
      }

      const response = await fastApi.get(`/${endpoint}`, { params });
      const data = response.data?.data || response.data;
      const items = Array.isArray(data) ? data : [];

      console.log(`✅ ${endpoint} fetched successfully:`, items.length, 'items');
      
      cache.set(cacheKey, items);
      return items;
    } catch (error) {
      console.error(`❌ Error fetching ${endpoint}:`, error);
      
      // Enhanced error handling
      if (error.response?.status === 404) {
        console.error(`${endpoint} endpoint not found. Please check backend routes.`);
        return [];
      }
      
      const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      return cached || [];
    }
  },

  getById: async (id) => {
    try {
      console.log(`🔍 Fetching ${endpoint} by ID:`, id);
      const response = await api.get(`/${endpoint}/${id}`);
      console.log(`✅ ${endpoint} fetched successfully`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error fetching ${endpoint}:`, error);
      
      let errorMessage = handleApiError(error);
      if (error.response?.status === 404) {
        errorMessage = `${endpoint} not found with ID: ${id}`;
      }
      
      throw new Error(errorMessage);
    }
  },

  create: async (data) => {
    try {
      console.log(`🆕 Creating ${endpoint}:`, data);
      const response = await quickApi.post(`/${endpoint}`, data);
      cache.clearAll();
      console.log(`✅ ${endpoint} created successfully`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error creating ${endpoint}:`, error);
      
      let errorMessage = handleApiError(error);
      if (error.response?.status === 404) {
        errorMessage = `${endpoint} creation endpoint not found. Please check backend routes.`;
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || `Invalid ${endpoint} data provided`;
      } else if (error.response?.status === 500) {
        errorMessage = `Server error while creating ${endpoint}. Please try again.`;
      }
      
      throw new Error(errorMessage);
    }
  },

  update: async (id, data) => {
    try {
      console.log(`✏️ Updating ${endpoint} ID:`, id, 'with data:', data);
      const response = await api.put(`/${endpoint}/${id}`, data);
      cache.clearAll();
      console.log(`✅ ${endpoint} updated successfully`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error updating ${endpoint}:`, error);
      
      let errorMessage = handleApiError(error);
      if (error.response?.status === 404) {
        errorMessage = `${endpoint} not found with ID: ${id}`;
      }
      
      throw new Error(errorMessage);
    }
  },

  delete: async (id) => {
    try {
      console.log(`🗑️ Deleting ${endpoint} ID:`, id);
      const response = await api.delete(`/${endpoint}/${id}`);
      cache.clearAll();
      console.log(`✅ ${endpoint} deleted successfully`);
      return response.data?.data || response.data;
    } catch (error) {
      console.error(`❌ Error deleting ${endpoint}:`, error);
      
      let errorMessage = handleApiError(error);
      if (error.response?.status === 404) {
        errorMessage = `${endpoint} not found with ID: ${id}`;
      } else if (error.response?.status === 409) {
        errorMessage = `Cannot delete ${endpoint} - it may be in use by other records`;
      }
      
      throw new Error(errorMessage);
    }
  }
});

export const productAPI = createBasicAPI('products');
export const shopAPI = createBasicAPI('shops');
export const cashierAPI = createBasicAPI('cashiers');

// Enhanced expense API with additional methods
export const expenseAPI = {
  ...createBasicAPI('expenses'),
  
  getStats: async (params = {}) => {
    try {
      console.log('📊 Fetching expense stats with optimized timeout...');
      const response = await quickApi.get('/expenses/stats/overview', { params });
      console.log('✅ Expense stats fetched successfully');
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching expense stats:', error);
      
      // Return comprehensive default stats instead of throwing error
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
      console.log('📅 Fetching expenses by date range with optimized timeout...');
      const response = await quickApi.get('/expenses', {
        params: { startDate, endDate }
      });
      const data = response.data?.data || response.data;
      console.log('✅ Date range expenses fetched successfully:', data?.length || 0, 'items');
      return data;
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
      console.log('📈 Fetching complete dashboard data with optimized timeout...');
      
      const [transactionsData, creditAnalysis] = await Promise.all([
        unifiedAPI.getCombinedTransactions(filters),
        unifiedAPI.getCombinedCreditAnalysis(filters)
      ]);
      
      const dashboardData = {
        ...transactionsData,
        creditAnalysis,
        creditStats: creditAnalysis.summary,
        loadedAt: new Date().toISOString(),
        dataSources: {
          transactions: transactionsData.transactions?.length || 0,
          shops: transactionsData.shops?.length || 0,
          cashiers: transactionsData.cashiers?.length || 0,
          products: transactionsData.products?.length || 0,
          credits: creditAnalysis.credits?.length || 0,
          expenses: transactionsData.expenses?.length || 0
        }
      };
      
      console.log('✅ Enhanced dashboard data loaded successfully');
      return dashboardData;
    } catch (error) {
      console.error('❌ Error loading enhanced dashboard data:', error);
      
      // Try to provide partial data if possible
      try {
        const transactionsData = await unifiedAPI.getCombinedTransactions(filters);
        const creditAnalysis = await unifiedAPI.getCombinedCreditAnalysis(filters);
        
        return {
          ...transactionsData,
          creditAnalysis,
          creditStats: creditAnalysis.summary,
          loadedAt: new Date().toISOString(),
          dataSources: {
            transactions: transactionsData.transactions?.length || 0,
            shops: transactionsData.shops?.length || 0,
            cashiers: transactionsData.cashiers?.length || 0,
            products: transactionsData.products?.length || 0,
            credits: creditAnalysis.credits?.length || 0,
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
      filters,
      summary: analysis.summary
    };
  },

  // Optimized cashier dashboard data
  getCashierDashboard: async (filters = {}) => {
    try {
      console.log('👤 Fetching cashier dashboard data with optimized timeout...');
      
      const [metrics, transactions] = await Promise.all([
        unifiedAPI.getCashierDashboardMetrics(filters),
        unifiedAPI.getCombinedTransactions(filters)
      ]);
      
      const dashboardData = {
        ...metrics,
        recentTransactions: transactions.transactions?.slice(0, 10) || [],
        loadedAt: new Date().toISOString()
      };
      
      console.log('✅ Cashier dashboard data loaded successfully');
      return dashboardData;
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
  // Get comprehensive cashier analytics
  getCashierAnalytics: async (cashierId, params = {}) => {
    try {
      console.log('📊 Fetching cashier analytics with optimized timeout...', { cashierId, params });
      
      const cacheKey = `cashier_analytics_${cashierId}_${JSON.stringify(params)}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Using cached cashier analytics');
        return cached;
      }

      const response = await quickApi.get(`/cashiers/${cashierId}/analytics`, { params });
      const analyticsData = response.data?.data || response.data;
      
      cache.set(cacheKey, analyticsData);
      console.log('✅ Cashier analytics fetched successfully');
      return analyticsData;
    } catch (error) {
      console.error('❌ Error fetching cashier analytics:', error);
      
      // Return comprehensive fallback analytics data
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

  // Get cashier performance summary
  getCashierPerformance: async (cashierId, params = {}) => {
    try {
      console.log('📈 Fetching cashier performance summary...', { cashierId, params });
      
      const response = await quickApi.get(`/cashiers/${cashierId}/performance`, { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching cashier performance:', error);
      throw new Error(handleApiError(error));
    }
  },

  // Get cashier's recent transactions
  getCashierTransactions: async (cashierId, params = {}) => {
    try {
      console.log('📋 Fetching cashier transactions...', { cashierId, params });
      
      const response = await quickApi.get(`/cashiers/${cashierId}/transactions`, { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching cashier transactions:', error);
      throw new Error(handleApiError(error));
    }
  },

  // Get cashier's credit sales
  getCashierCredits: async (cashierId, params = {}) => {
    try {
      console.log('💳 Fetching cashier credits...', { cashierId, params });
      
      const response = await quickApi.get(`/cashiers/${cashierId}/credits`, { params });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('❌ Error fetching cashier credits:', error);
      throw new Error(handleApiError(error));
    }
  },

  // Get cashiers with performance metrics
  getCashiersWithMetrics: async (params = {}) => {
    try {
      console.log('👥 Fetching cashiers with metrics...', { params });
      
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
  // Unified endpoints (recommended)
  unified: unifiedAPI,
  
  // Legacy endpoints (for backward compatibility)
  auth: authAPI,
  transactions: transactionAPI,
  products: productAPI,
  shops: shopAPI,
  cashiers: cashierAPI,
  expenses: expenseAPI,
  credits: creditAPI,
  reports: reportAPI,
  cashierAnalytics: cashierAnalyticsAPI,
  
  // Utility functions
  handleApiError,
  cache,
  
  // Performance utilities
  clearCache: () => cache.clearAll(),
  getCacheStats: () => ({
    size: Object.keys(cache.data).length,
    keys: Object.keys(cache.data)
  })
};

export default apiService;
export { handleApiError };