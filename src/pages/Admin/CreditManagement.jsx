import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Tag,
  Space,
  Typography,
  Alert,
  notification,
  Row,
  Col,
  Popconfirm,
  Tooltip,
  Badge,
  Divider,
  Descriptions,
  Spin,
  Empty
} from 'antd';
import {
  DollarOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserOutlined,
  ShopOutlined,
  EditOutlined,
  SyncOutlined,
  FilterOutlined,
  CreditCardOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { creditAPI, shopAPI, transactionAPI } from '../../services/api';
import { shopUtils } from '../../utils/shopUtils';
import CalculationUtils from '../../utils/calculationUtils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

// Cache for API responses
const apiCache = {
  shops: null,
  credits: null,
  lastFetch: null
};

const CreditManagement = ({ currentUser, shops: initialShops = [], onPaymentSuccess }) => {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState('all');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [paymentForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [dueSoonCredits, setDueSoonCredits] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Refs for tracking
  const isInitialMount = useRef(true);
  const apiCallTimeoutRef = useRef(null);
  const lastFetchTimeRef = useRef(null);
  const retryCountRef = useRef(0);

  // Safe current user access
  const getCurrentUser = useCallback(() => {
    try {
      const storedUser = localStorage.getItem('cashierData') || localStorage.getItem('userData');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser._id && parsedUser._id !== 'unknown-user') {
          return parsedUser;
        }
      }
    } catch (error) {
      console.error('Error parsing stored user data:', error);
    }
    
    return currentUser || { 
      _id: null,
      name: 'System', 
      role: 'user' 
    };
  }, [currentUser]);

  // Initialize shops with caching
  useEffect(() => {
    const initializeShops = async () => {
      // Use cached shops if available and less than 5 minutes old
      if (apiCache.shops && apiCache.lastFetch && (Date.now() - apiCache.lastFetch < 300000)) {
        console.log('🔄 Using cached shops data');
        setShops(apiCache.shops);
        return;
      }

      // If we have initial shops from props, use them
      if (initialShops && initialShops.length > 0) {
        setShops(initialShops);
        apiCache.shops = initialShops;
        apiCache.lastFetch = Date.now();
        return;
      }

      try {
        console.log('🔄 Fetching shops...');
        const shopsResponse = await shopAPI.getAll();
        const shopsData = Array.isArray(shopsResponse?.data) ? shopsResponse.data : 
                         Array.isArray(shopsResponse) ? shopsResponse : [];
        
        setShops(shopsData);
        apiCache.shops = shopsData;
        apiCache.lastFetch = Date.now();
        console.log('✅ Shops initialized:', shopsData.length);
      } catch (error) {
        console.error('Error fetching shops:', error);
        // Use cached data if available, even if stale
        if (apiCache.shops) {
          setShops(apiCache.shops);
        }
      }
    };

    initializeShops();
  }, [initialShops]);

  // Calculate credit status
  const calculateCreditStatus = useCallback((credit, balanceDue) => {
    if (balanceDue <= 0) {
      return 'paid';
    }
    
    if (credit.amountPaid > 0 && balanceDue > 0) {
      return 'partially_paid';
    }
    
    if (credit.dueDate && dayjs(credit.dueDate).isBefore(dayjs())) {
      return 'overdue';
    }
    
    return 'pending';
  }, []);

  // Check for credits due in 2 days
  const checkDueSoonCredits = useCallback((creditsData) => {
    if (!Array.isArray(creditsData)) {
      setDueSoonCredits([]);
      return;
    }

    const dueSoon = creditsData.filter(credit => {
      if (!credit || credit.status === 'paid') return false;
      
      const dueDate = dayjs(credit.dueDate);
      if (!dueDate.isValid()) return false;
      
      const daysUntilDue = dueDate.diff(dayjs(), 'day');
      
      return daysUntilDue <= 2 && daysUntilDue >= 0;
    });

    setDueSoonCredits(dueSoon);

    // Show notification for due soon credits
    const user = getCurrentUser();
    if (dueSoon.length > 0 && user?.role === 'admin') {
      notification.warning({
        message: 'Credit Payment Reminder',
        description: `${dueSoon.length} credit(s) are due in 2 days or less.`,
        duration: 0,
        btn: (
          <Button 
            type="primary" 
            size="small" 
            onClick={() => notification.destroy()}
          >
            View Details
          </Button>
        ),
      });
    }
  }, [getCurrentUser]);

  // Optimized credit fetching with better caching and throttling
  const fetchCredits = useCallback(async (forceRefresh = false) => {
    // Prevent too frequent API calls (minimum 15 seconds between calls)
    const now = Date.now();
    if (lastFetchTimeRef.current && (now - lastFetchTimeRef.current < 15000) && !forceRefresh) {
      console.log('⏳ Skipping fetch - too soon since last call');
      return;
    }

    // Use cached data if available and not forcing refresh
    if (apiCache.credits && !forceRefresh && apiCache.lastFetch && (now - apiCache.lastFetch < 60000)) {
      console.log('🔄 Using cached credits data');
      setCredits(apiCache.credits);
      
      // Still check for due soon credits with cached data
      checkDueSoonCredits(apiCache.credits);
      return;
    }

    // Clear any existing timeout
    if (apiCallTimeoutRef.current) {
      clearTimeout(apiCallTimeoutRef.current);
    }

    setLoading(true);
    try {
      const params = {
        includeTransactions: 'true',
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 1000,
        sort: '-createdAt'
      };
      
      if (selectedShop && selectedShop !== 'all') {
        params.shopId = selectedShop;
      }
      
      console.log('📋 Fetching credits with params:', params);
      
      const response = await creditAPI.getAll(params);
      
      // Process credits data
      const creditsData = Array.isArray(response?.data) ? response.data : [];
      
      console.log('✅ Raw credits data received:', creditsData.length, 'items');
      
      // Remove duplicate credits
      const uniqueCreditsMap = new Map();
      creditsData.forEach(credit => {
        let transactionId = credit.transactionId;
        
        if (transactionId && typeof transactionId === 'object') {
          transactionId = transactionId._id || transactionId.id || transactionId.transactionId;
        }
        
        const key = transactionId || credit._id;
        if (!uniqueCreditsMap.has(key)) {
          uniqueCreditsMap.set(key, {
            ...credit,
            transactionId: transactionId
          });
        }
      });
      
      const uniqueCredits = Array.from(uniqueCreditsMap.values());
      
      // Process credits
      const creditsWithDetails = uniqueCredits.map((credit) => {
        const totalAmount = Number(credit.totalAmount) || 0;
        const amountPaid = Number(credit.amountPaid) || 0;
        const balanceDue = totalAmount - amountPaid;
        
        // Enhance credit with shop information
        const shopInfo = shopUtils.getShopDetails(credit.shopId, shops);
        
        let transactionDetails = null;
        let transactionId = credit.transactionId;
        
        // Create transaction details from credit data without API call
        if (transactionId) {
          transactionDetails = {
            transactionNumber: transactionId,
            saleDate: credit.saleDate || credit.createdAt,
            totalAmount: totalAmount,
            items: credit.items || [],
            customerName: credit.customerName,
            customerPhone: credit.customerPhone,
            cashierName: credit.cashierName,
            shopName: shopInfo?.name || 'Unknown Shop'
          };
        }
        
        return {
          ...credit,
          transactionId: transactionId,
          totalAmount,
          amountPaid,
          balanceDue: Math.max(0, balanceDue),
          shopName: shopInfo?.name || 'Unknown Shop',
          shopType: shopInfo?.type || 'Unknown',
          transactionDetails,
          status: calculateCreditStatus(credit, balanceDue)
        };
      });
      
      setCredits(creditsWithDetails);
      
      // Update cache
      apiCache.credits = creditsWithDetails;
      apiCache.lastFetch = Date.now();
      lastFetchTimeRef.current = Date.now();
      retryCountRef.current = 0;
      
      // Check for credits due in 2 days
      checkDueSoonCredits(creditsWithDetails);
      
      console.log('✅ Credits processed successfully:', creditsWithDetails.length, 'credits');
    } catch (error) {
      console.error('Error fetching credits:', error);
      
      // Use cached data if available
      if (apiCache.credits) {
        console.log('🔄 Falling back to cached credits due to error');
        setCredits(apiCache.credits);
      } else {
        setCredits([]);
      }
      
      let errorMessage = 'Failed to load credits';
      
      if (error.response?.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
        // Don't retry on 429, wait longer
        lastFetchTimeRef.current = Date.now() + 30000; // Wait 30 seconds before next attempt
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timeout. The server is taking too long to respond.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error while loading credits. Please try again.';
      }
      
      notification.error({
        message: 'Failed to load credits',
        description: errorMessage,
        duration: 5,
      });
    } finally {
      setLoading(false);
      isInitialMount.current = false;
    }
  }, [selectedShop, statusFilter, shops, calculateCreditStatus, checkDueSoonCredits]);

  // Fetch payment history for a credit
  const fetchPaymentHistory = async (creditId) => {
    try {
      if (!creditId) {
        setPaymentHistory([]);
        return;
      }

      const response = await creditAPI.getPaymentHistory(creditId);
      const history = Array.isArray(response?.data) ? response.data : [];
      
      const formattedHistory = history.map(payment => ({
        ...payment,
        paymentDate: payment.paymentDate || payment.createdAt,
        amount: Number(payment.amount) || 0,
        paymentMethod: payment.paymentMethod || 'unknown',
        recordedBy: payment.recordedBy || 'Unknown',
        cashierName: payment.cashierName || payment.recordedBy || 'Unknown'
      }));
      
      setPaymentHistory(formattedHistory);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      notification.error({
        message: 'Failed to load payment history',
        description: error.response?.data?.message || error.message
      });
      setPaymentHistory([]);
    }
  };

  // Enhanced filtering function
  const getFilteredCredits = () => {
    let filtered = credits;

    // Filter by shop
    if (selectedShop !== 'all') {
      filtered = shopUtils.filterCreditsByShop(filtered, selectedShop, shops);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(credit => credit.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = shopUtils.searchCredits(filtered, searchTerm, shops);
    }

    return filtered;
  };

  // Unified credit stats calculation
  const calculateStats = () => {
    const filteredCredits = getFilteredCredits();
    
    if (!Array.isArray(filteredCredits)) {
      return CalculationUtils.getDefaultStatsWithCreditManagement();
    }

    const totalCreditSales = filteredCredits.reduce((sum, credit) => 
      sum + CalculationUtils.safeNumber(credit.totalAmount), 0
    );

    const recognizedCreditRevenue = filteredCredits.reduce((sum, credit) => 
      sum + CalculationUtils.safeNumber(credit.amountPaid), 0
    );

    const outstandingCredit = filteredCredits.reduce((sum, credit) => 
      sum + CalculationUtils.safeNumber(credit.balanceDue), 0
    );

    const creditSalesCount = filteredCredits.length;

    const averageCreditSale = creditSalesCount > 0 ? totalCreditSales / creditSalesCount : 0;

    const creditCollectionRate = totalCreditSales > 0 ? 
      (recognizedCreditRevenue / totalCreditSales) * 100 : 0;

    return {
      totalCreditSales: parseFloat(totalCreditSales.toFixed(2)),
      recognizedCreditRevenue: parseFloat(recognizedCreditRevenue.toFixed(2)),
      outstandingCredit: parseFloat(outstandingCredit.toFixed(2)),
      averageCreditSale: parseFloat(averageCreditSale.toFixed(2)),
      creditSalesCount,
      creditCollectionRate: parseFloat(creditCollectionRate.toFixed(2))
    };
  };

  // Handle credit payment
  const handlePayment = async (values) => {
    try {
      if (!selectedCredit || !selectedCredit._id) {
        notification.error({
          message: 'Error',
          description: 'No credit selected for payment'
        });
        return;
      }

      const paymentAmount = Number(values.amount) || 0;

      // Use the unified credit payment handler
      await handleCreditPayment(selectedCredit, paymentAmount, values.paymentMethod);
      
      setPaymentModalVisible(false);
      setSelectedCredit(null);
      paymentForm.resetFields();
      
    } catch (error) {
      console.error('Error recording payment:', error);
    }
  };

  // UPDATED: Unified credit payment handler with proper upfront payment alignment
  const handleCreditPayment = async (credit, paymentAmount, paymentMethod) => {
    try {
      if (!credit || !credit._id) {
        throw new Error('Invalid credit record');
      }

      const user = getCurrentUser();
      
      // Enhanced validation
      if (!paymentAmount || paymentAmount <= 0) {
        throw new Error('Invalid payment amount');
      }

      if (!paymentMethod) {
        throw new Error('Payment method is required');
      }

      // Validate payment doesn't exceed balance
      const balanceDue = Number(credit.balanceDue) || 0;
      if (paymentAmount > balanceDue) {
        throw new Error(`Payment amount (${formatCurrency(paymentAmount)}) exceeds balance due (${formatCurrency(balanceDue)})`);
      }

      console.log('💰 Processing credit payment with upfront payment alignment:', {
        creditId: credit._id,
        customer: credit.customerName,
        paymentAmount,
        paymentMethod,
        balanceDue,
        originalTotal: credit.totalAmount
      });

      // Get shop details
      const shopDetails = shopUtils.getShopDetails(credit.shopId, shops);
      const shopName = shopDetails?.name || credit.shopName || 'Unknown Shop';

      // Create payment transaction data aligned with server expectations
      const paymentTransactionData = {
        transactionNumber: `PAY-${Date.now().toString().slice(-8)}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        totalAmount: Number(paymentAmount),
        paymentMethod: paymentMethod,
        customerName: credit.customerName || 'Unknown Customer',
        shopName: shopName,
        shopId: credit.shopId,
        cashierId: user._id,
        cashierName: user.name || 'System',
        saleDate: new Date().toISOString(),
        isCreditPayment: true,
        originalCreditId: credit._id,
        status: 'completed',
        items: [{
          productName: `Credit Payment - ${credit.customerName}`,
          quantity: 1,
          price: Number(paymentAmount),
          totalPrice: Number(paymentAmount)
        }],
        notes: `Credit payment for ${credit.customerName}`,
        
        // UPDATED: Align with server upfront payment structure
        recognizedRevenue: Number(paymentAmount),
        immediateRevenue: Number(paymentAmount),
        amountPaid: Number(paymentAmount),
        outstandingRevenue: 0,
        isCreditTransaction: false,
        
        // UPDATED: Enhanced payment split for proper dashboard display
        paymentSplit: {
          cash: paymentMethod === 'cash' ? Number(paymentAmount) : 0,
          bank_mpesa: ['mpesa', 'bank', 'card', 'bank_mpesa'].includes(paymentMethod) ? Number(paymentAmount) : 0,
          credit: 0
        }
      };

      console.log('📤 Sending aligned payment transaction data:', paymentTransactionData);

      // Create payment transaction
      const response = await transactionAPI.create(paymentTransactionData);
      
      let success = false;
      let transactionId = null;

      console.log('📥 Raw API Response:', response);

      // Check various possible success response structures
      if (response) {
        if (response.success === true) {
          success = true;
          if (response.data) {
            if (response.data._id) {
              transactionId = response.data._id;
            } else if (response.data.paymentTransaction && response.data.paymentTransaction._id) {
              transactionId = response.data.paymentTransaction._id;
            }
          }
        }
        else if (response._id) {
          success = true;
          transactionId = response._id;
        }
        else if (response.paymentTransaction && response.paymentTransaction._id) {
          success = true;
          transactionId = response.paymentTransaction._id;
        }
        else if (response.data && (response.data._id || response.data.success)) {
          success = true;
          transactionId = response.data._id;
        }
        else if (response && typeof response === 'object') {
          success = true;
          console.log('ℹ️  Response received but no clear success indicator, assuming success:', response);
        }
      }

      if (success) {
        console.log('✅ Credit payment transaction created successfully:', {
          transactionId,
          amount: paymentAmount,
          creditId: credit._id,
          responseStructure: Object.keys(response || {})
        });

        // UPDATED: Update the credit record to reflect the payment
        try {
          const updatedAmountPaid = (Number(credit.amountPaid) || 0) + Number(paymentAmount);
          const updatedBalanceDue = Math.max(0, (Number(credit.totalAmount) || 0) - updatedAmountPaid);
          
          const creditUpdateData = {
            amountPaid: updatedAmountPaid,
            balanceDue: updatedBalanceDue,
            status: updatedBalanceDue <= 0 ? 'paid' : (updatedAmountPaid > 0 ? 'partially_paid' : 'pending')
          };

          // Add to payment history
          if (!credit.paymentHistory) {
            creditUpdateData.paymentHistory = [];
          }
          
          creditUpdateData.paymentHistory.push({
            amount: Number(paymentAmount),
            paymentDate: new Date().toISOString(),
            paymentMethod: paymentMethod,
            recordedBy: user.name || 'System',
            cashierName: user.name || 'System',
            notes: `Payment recorded via Credit Management`
          });

          await creditAPI.update(credit._id, creditUpdateData);
          console.log('✅ Credit record updated with payment');
          
        } catch (updateError) {
          console.error('⚠️ Could not update credit record, but payment was recorded:', updateError);
          // Continue since the payment transaction was successful
        }

        notification.success({
          message: 'Credit Payment Recorded',
          description: `Payment of ${formatCurrency(paymentAmount)} recorded successfully.`,
        });
        
        // Refresh credits to show updated balances
        fetchCredits(true); // Force refresh
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
        
        return true;
      } else {
        console.error('❌ Unexpected response structure:', response);
        throw new Error(response?.message || 'Unexpected response from server');
      }
    } catch (error) {
      console.error('❌ ERROR processing credit payment:', error);
      
      let userMessage = 'Payment failed due to server error';
      
      if (error.response?.status === 500) {
        const serverError = error.response?.data;
        console.error('🔍 Server error details:', serverError);
        userMessage = serverError?.error || serverError?.message || 'Server error while processing payment';
      } else if (error.response?.status === 400) {
        userMessage = error.response?.data?.message || 'Invalid payment data provided';
      } else if (error.response?.status === 404) {
        userMessage = 'Payment service unavailable. Please try again.';
      } else if (error.message) {
        userMessage = error.message;
      }
      
      notification.error({
        message: 'Payment Failed',
        description: userMessage,
        duration: 8,
      });
      
      throw error;
    }
  };

  // Handle update credit record
  const handleUpdateCredit = async (values) => {
    try {
      if (!selectedCredit || !selectedCredit._id) {
        notification.error({
          message: 'Error',
          description: 'No credit selected for update'
        });
        return;
      }

      const updateData = {
        shopId: values.shopId,
        cashierName: values.cashierName,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        dueDate: values.dueDate,
        creditShopName: values.shopName,
        creditShopId: values.shopId,
        shopClassification: values.shopName
      };

      await creditAPI.update(selectedCredit._id, updateData);
      
      notification.success({
        message: 'Credit Record Updated',
        description: 'Credit record has been updated successfully.'
      });

      setEditModalVisible(false);
      setSelectedCredit(null);
      editForm.resetFields();
      fetchCredits(true); // Force refresh after update
    } catch (error) {
      console.error('Error updating credit:', error);
      notification.error({
        message: 'Update Failed',
        description: error.response?.data?.message || error.message
      });
    }
  };

  // Handle delete credit record
  const handleDeleteCredit = async (creditId) => {
    try {
      if (!creditId) {
        notification.error({
          message: 'Error',
          description: 'No credit ID provided for deletion'
        });
        return;
      }

      await creditAPI.delete(creditId);
      
      notification.success({
        message: 'Credit Record Deleted',
        description: 'Credit record has been deleted successfully.'
      });

      fetchCredits(true); // Force refresh after delete
    } catch (error) {
      console.error('Error deleting credit:', error);
      notification.error({
        message: 'Delete Failed',
        description: error.response?.data?.message || error.message
      });
    }
  };

  const filteredCredits = getFilteredCredits();
  const stats = calculateStats();

  // Safe data formatting functions
  const formatCurrency = (amount) => {
    const value = Number(amount) || 0;
    return `KES ${value.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return dayjs(date).format('DD/MM/YYYY HH:mm');
  };

  const getStatusConfig = (status) => {
    const statusConfig = {
      pending: { color: 'orange', text: 'Pending', icon: <ClockCircleOutlined /> },
      partially_paid: { color: 'blue', text: 'Partially Paid', icon: <DollarOutlined /> },
      paid: { color: 'green', text: 'Paid', icon: <CheckCircleOutlined /> },
      overdue: { color: 'red', text: 'Overdue', icon: <ExclamationCircleOutlined /> }
    };
    
    return statusConfig[status] || statusConfig.pending;
  };

  // Get shop display name
  const getShopDisplayName = (shopId) => {
    const shop = shopUtils.getShopDetails(shopId, shops);
    if (!shop) return 'Unknown Shop';
    return shop.type ? `${shop.name} (${shop.type})` : shop.name;
  };

  // Open edit modal with current data
  const openEditModal = (credit) => {
    if (!credit) return;
    
    setSelectedCredit(credit);
    editForm.setFieldsValue({
      shopId: credit.shopId,
      shopName: credit.shopName || credit.creditShopName,
      cashierName: credit.cashierName,
      customerName: credit.customerName,
      customerPhone: credit.customerPhone,
      dueDate: credit.dueDate ? dayjs(credit.dueDate) : null
    });
    setEditModalVisible(true);
  };

  // Enhanced columns with proper transaction ID handling
  const columns = [
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(text || 'Unknown Customer')}</Text>
          {record.customerPhone && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {String(record.customerPhone || '')}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Shop & Classification',
      dataIndex: 'shopId',
      key: 'shopId',
      width: 200,
      render: (shopId, record) => {
        const shop = shopUtils.getShopDetails(shopId, shops);
        const displayShop = shop || { name: record.shopName || 'Unknown Shop', type: record.shopType };
        
        return (
          <Space direction="vertical" size={0}>
            <Tag 
              icon={<ShopOutlined />} 
              color={shop ? 'blue' : 'orange'}
              style={{ margin: 0 }}
            >
              {displayShop.name}
            </Tag>
            {displayShop?.type && (
              <Text type="secondary" style={{ fontSize: '11px' }}>
                <EnvironmentOutlined /> Type: {String(displayShop.type)}
              </Text>
            )}
            {record.shopClassification && (
              <Text type="secondary" style={{ fontSize: '10px' }}>
                📍 Classification: {String(record.shopClassification)}
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Cashier',
      dataIndex: 'cashierName',
      key: 'cashierName',
      width: 120,
      render: (name, record) => (
        <Space direction="vertical" size={0}>
          {name && (
            <Text style={{ fontSize: '12px' }}>
              <UserOutlined /> {String(name)}
            </Text>
          )}
          {record.recordedBy && record.recordedBy !== name && (
            <Text type="secondary" style={{ fontSize: '10px' }}>
              Recorded by: {String(record.recordedBy)}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (amount) => formatCurrency(amount)
    },
    {
      title: 'Amount Paid',
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      width: 120,
      render: (amount) => formatCurrency(amount)
    },
    {
      title: 'Balance Due',
      dataIndex: 'balanceDue',
      key: 'balanceDue',
      width: 130,
      render: (balance, record) => {
        const safeBalance = Number(balance) || 0;
        return (
          <Text strong type={safeBalance > 0 ? 'danger' : 'success'}>
            {formatCurrency(safeBalance)}
          </Text>
        );
      }
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 140,
      render: (date, record) => {
        if (!date) return 'N/A';
        
        const dueDate = dayjs(date);
        const today = dayjs();
        
        if (!dueDate.isValid()) return 'Invalid Date';
        
        const daysUntilDue = dueDate.diff(today, 'day');
        
        let color = 'blue';
        let status = 'On Time';
        
        if (record.status === 'paid') {
          color = 'green';
          status = 'Paid';
        } else if (daysUntilDue < 0) {
          color = 'red';
          status = 'Overdue';
        } else if (daysUntilDue <= 2) {
          color = 'orange';
          status = 'Due Soon';
        }
        
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: '12px' }}>{dueDate.format('DD/MM/YYYY')}</Text>
            <Tag color={color} style={{ fontSize: '10px', margin: 0 }}>
              {status}
            </Tag>
          </Space>
        );
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status, record) => {
        const config = getStatusConfig(status);
        const isOverdue = record.dueDate && dayjs(record.dueDate).isBefore(dayjs()) && record.balanceDue > 0;
        
        return (
          <Tag color={isOverdue ? 'red' : config.color} icon={config.icon}>
            {isOverdue ? 'Overdue' : config.text}
          </Tag>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        if (!record || !record._id) return null;
        
        const safeBalance = Number(record.balanceDue) || 0;
        
        return (
          <Space size="small">
            {record.status !== 'paid' && safeBalance > 0 && (
              <Tooltip title="Record Payment">
                <Button
                  type="link"
                  size="small"
                  icon={<DollarOutlined />}
                  onClick={() => {
                    setSelectedCredit(record);
                    setPaymentModalVisible(true);
                    paymentForm.setFieldsValue({
                      amount: safeBalance,
                      paymentMethod: 'cash'
                    });
                  }}
                >
                  Pay
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Edit Record">
              <Button 
                type="link" 
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEditModal(record)}
              >
                Edit
              </Button>
            </Tooltip>
            <Tooltip title="View payment history">
              <Button 
                type="link" 
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedCredit(record);
                  fetchPaymentHistory(record._id);
                  setHistoryModalVisible(true);
                }}
              >
                History
              </Button>
            </Tooltip>
            <Popconfirm
              title="Delete Credit Record"
              description="Are you sure you want to delete this credit record? This action cannot be undone."
              onConfirm={() => handleDeleteCredit(record._id)}
              okText="Yes, Delete"
              cancelText="Cancel"
              okType="danger"
            >
              <Tooltip title="Delete Record">
                <Button 
                  type="link" 
                  size="small" 
                  danger 
                  icon={<DeleteOutlined />}
                >
                  Delete
                </Button>
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  // Payment history columns
  const historyColumns = [
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      render: (date) => formatDate(date)
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => formatCurrency(amount)
    },
    {
      title: 'Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method) => (
        <Tag color={method === 'cash' ? 'green' : 'blue'}>
          {String(method?.toUpperCase() || 'N/A')}
        </Tag>
      )
    },
    {
      title: 'Recorded By',
      dataIndex: 'recordedBy',
      key: 'recordedBy',
      render: (name) => (
        <Space>
          <UserOutlined />
          {String(name || 'Unknown')}
        </Space>
      )
    },
    {
      title: 'Cashier',
      dataIndex: 'cashierName',
      key: 'cashierName',
      render: (name) => String(name || 'N/A')
    }
  ];

  // Optimized useEffect for fetching credits
  useEffect(() => {
    if (isInitialMount.current) {
      fetchCredits();
    }
  }, [fetchCredits]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (apiCallTimeoutRef.current) {
        clearTimeout(apiCallTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <CreditCardOutlined /> Credit Management
      </Title>

      {/* Connection Status Alert */}
      {retryCountRef.current > 0 && (
        <Alert
          message="Connection Issues Detected"
          description={`Attempting to reconnect... (${retryCountRef.current}/2)`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => fetchCredits(true)}>
              Retry Now
            </Button>
          }
        />
      )}

      {/* Due Soon Alert */}
      {dueSoonCredits.length > 0 && (
        <Alert
          message={`${dueSoonCredits.length} credit(s) due in 2 days or less`}
          description="Please follow up with customers for payment."
          type="warning"
          showIcon
          icon={<BellOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Credit Overview Section */}
      <Card style={{ marginBottom: 24 }} title={
        <Space>
          <ShopOutlined />
          {selectedShop === 'all' ? 'All Shops' : getShopDisplayName(selectedShop)}
          <Badge count={filteredCredits.length} showZero color="blue" />
        </Space>
      }>
        <Row gutter={[16, 16]}>
          {/* Total Credit Sales */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card size="small" bordered style={{ textAlign: 'center' }}>
              <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                {formatCurrency(stats.totalCreditSales)}
              </Text>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Total Credit Sales
                </Text>
              </div>
            </Card>
          </Col>

          {/* Recognized Credit Revenue */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card size="small" bordered style={{ textAlign: 'center' }}>
              <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                {formatCurrency(stats.recognizedCreditRevenue)}
              </Text>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Credit Revenue Collected
                </Text>
              </div>
            </Card>
          </Col>

          {/* Outstanding Credit */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card size="small" bordered style={{ textAlign: 'center' }}>
              <Text strong style={{ fontSize: '16px', color: '#fa541c' }}>
                {formatCurrency(stats.outstandingCredit)}
              </Text>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Outstanding Credit
                </Text>
              </div>
            </Card>
          </Col>

          {/* Credit Sales Count */}
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card size="small" bordered style={{ textAlign: 'center' }}>
              <Text strong style={{ fontSize: '16px', color: '#fa8c16' }}>
                {stats.creditSalesCount}
              </Text>
              <div style={{ marginTop: '8px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Credit Transactions
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Enhanced Filters with Shop Display */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8}>
            <Space>
              <Text strong>Shop:</Text>
              <Select
                value={selectedShop}
                onChange={setSelectedShop}
                style={{ width: 200 }}
                placeholder="Filter by shop"
                showSearch
                optionFilterProp="children"
                loading={shops.length === 0}
              >
                <Option value="all">
                  <Space>
                    <ShopOutlined />
                    All Shops ({shops.length})
                  </Space>
                </Option>
                {shops.map(shop => (
                  <Option key={shop._id} value={shop._id}>
                    <Space>
                      <ShopOutlined />
                      {shop.name}
                      {shop.type && (
                        <Tag color="blue" size="small">
                          {shop.type}
                        </Tag>
                      )}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Space>
              <Text strong>Status:</Text>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                placeholder="Filter by status"
              >
                <Option value="all">All Status</Option>
                <Option value="pending">Pending</Option>
                <Option value="partially_paid">Partially Paid</Option>
                <Option value="paid">Paid</Option>
                <Option value="overdue">Overdue</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={8}>
            <Search
              placeholder="Search customers, phone, transaction, shop..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
              allowClear
            />
          </Col>
          <Col xs={24}>
            <Space>
              <Button 
                onClick={() => fetchCredits(true)} 
                loading={loading}
                icon={<SyncOutlined />}
              >
                Refresh
              </Button>
              <Text type="secondary">
                Showing {filteredCredits.length} of {credits.length} credits
              </Text>
              {selectedShop !== 'all' && (
                <Tag color="blue" icon={<ShopOutlined />}>
                  Shop: {getShopDisplayName(selectedShop)}
                </Tag>
              )}
              {statusFilter !== 'all' && (
                <Tag color="orange">
                  Status: {statusFilter}
                </Tag>
              )}
              {searchTerm && (
                <Tag color="green">
                  Search: "{searchTerm}"
                </Tag>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Credits Table */}
      <Card
        title={
          <Space>
            <CreditCardOutlined />
            Credit Records
            <Badge count={filteredCredits.length} showZero />
          </Space>
        }
        loading={loading}
        extra={
          <Space>
            <FilterOutlined />
            <Text type="secondary">
              Shop: {selectedShop === 'all' ? `All Shops (${shops.length})` : getShopDisplayName(selectedShop)}
            </Text>
            <Button 
              icon={<SyncOutlined />} 
              onClick={() => fetchCredits(true)}
              loading={loading}
              size="small"
            >
              Refresh
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">Loading credit records...</Text>
            </div>
          </div>
        ) : filteredCredits.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <Text>No credit records found</Text>
                {credits.length === 0 && (
                  <Text type="secondary">
                    No data available
                  </Text>
                )}
              </Space>
            }
          >
            <Button type="primary" onClick={() => fetchCredits(true)}>
              Try Again
            </Button>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredCredits}
            rowKey="_id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} of ${total} credits`
            }}
            scroll={{ x: 1200 }}
            locale={{ emptyText: 'No credit records found' }}
          />
        )}
      </Card>

      {/* Payment Modal - Simplified version */}
      <Modal
        title="Record Credit Payment"
        open={paymentModalVisible}
        onCancel={() => {
          setPaymentModalVisible(false);
          setSelectedCredit(null);
          paymentForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        {selectedCredit && (
          <Form
            form={paymentForm}
            layout="vertical"
            onFinish={handlePayment}
          >
            <Form.Item label="Customer">
              <Input 
                value={selectedCredit.customerName || 'Unknown Customer'} 
                disabled 
              />
            </Form.Item>
            
            <Form.Item label="Shop Classification">
              <Input 
                value={getShopDisplayName(selectedCredit.shopId)} 
                disabled 
              />
            </Form.Item>
            
            <Form.Item label="Cashier">
              <Input 
                value={selectedCredit.cashierName || 'N/A'} 
                disabled 
              />
            </Form.Item>
            
            <Descriptions size="small" bordered column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Total Amount">
                {formatCurrency(selectedCredit.totalAmount)}
              </Descriptions.Item>
              <Descriptions.Item label="Amount Paid">
                {formatCurrency(selectedCredit.amountPaid)}
              </Descriptions.Item>
              <Descriptions.Item label="Current Balance">
                <Text strong type="danger">
                  {formatCurrency(selectedCredit.balanceDue)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusConfig(selectedCredit.status).color}>
                  {getStatusConfig(selectedCredit.status).text}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Form.Item
              name="amount"
              label="Payment Amount"
              rules={[
                { required: true, message: 'Please enter payment amount' },
                {
                  validator: (_, value) => {
                    const balance = Number(selectedCredit.balanceDue) || 0;
                    if (value > balance) {
                      return Promise.reject(`Payment amount cannot exceed balance due of ${formatCurrency(balance)}`);
                    }
                    if (value <= 0) {
                      return Promise.reject('Payment amount must be greater than 0');
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Enter payment amount"
                min={0.01}
                max={Number(selectedCredit.balanceDue) || 0}
                step={0.01}
                precision={2}
                formatter={value => `KES ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/KES\s?|(,*)/g, '')}
              />
            </Form.Item>

            <Form.Item
              name="paymentMethod"
              label="Payment Method"
              rules={[{ required: true, message: 'Please select payment method' }]}
            >
              <Select placeholder="Select payment method">
                <Option value="cash">Cash</Option>
                <Option value="mpesa">M-Pesa</Option>
                <Option value="bank">Bank Transfer</Option>
                <Option value="card">Card</Option>
              </Select>
            </Form.Item>

            <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  icon={<DollarOutlined />}
                >
                  Record Payment
                </Button>
                <Button 
                  onClick={() => {
                    setPaymentModalVisible(false);
                    setSelectedCredit(null);
                    paymentForm.resetFields();
                  }}
                >
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Edit Credit Modal */}
      <Modal
        title="Edit Credit Record"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedCredit(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        {selectedCredit && (
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleUpdateCredit}
          >
            <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Transaction">
                {String(selectedCredit.transactionId || 'N/A')}
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                {formatCurrency(selectedCredit.totalAmount)}
              </Descriptions.Item>
              <Descriptions.Item label="Amount Paid">
                {formatCurrency(selectedCredit.amountPaid)}
              </Descriptions.Item>
              <Descriptions.Item label="Balance Due">
                {formatCurrency(selectedCredit.balanceDue)}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Form.Item
              name="shopId"
              label="Shop Classification"
              rules={[{ required: true, message: 'Please select a shop' }]}
            >
              <Select placeholder="Select shop" showSearch>
                {shops.map(shop => (
                  <Option key={shop._id} value={shop._id}>
                    {shop.name} {shop.type ? `(${shop.type})` : ''}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="shopName"
              label="Shop Name"
              rules={[{ required: true, message: 'Please enter shop name' }]}
            >
              <Input 
                placeholder="Enter shop name"
                prefix={<ShopOutlined />}
              />
            </Form.Item>

            <Form.Item
              name="cashierName"
              label="Cashier Name"
              rules={[{ required: true, message: 'Please enter cashier name' }]}
            >
              <Input 
                placeholder="Enter cashier name"
                prefix={<UserOutlined />}
              />
            </Form.Item>

            <Form.Item
              name="customerName"
              label="Customer Name"
              rules={[{ required: true, message: 'Please enter customer name' }]}
            >
              <Input 
                placeholder="Enter customer name"
              />
            </Form.Item>

            <Form.Item
              name="customerPhone"
              label="Customer Phone"
              rules={[
                { required: true, message: 'Please enter customer phone' },
                { pattern: /^[0-9+\-\s()]{10,}$/, message: 'Please enter a valid phone number' }
              ]}
            >
              <Input 
                placeholder="Enter customer phone"
              />
            </Form.Item>

            <Form.Item
              name="dueDate"
              label="Due Date"
              rules={[{ required: true, message: 'Please select due date' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={(current) => current && current < dayjs().endOf('day')}
                format="DD/MM/YYYY"
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  icon={<CheckCircleOutlined />}
                >
                  Update Record
                </Button>
                <Button 
                  onClick={() => {
                    setEditModalVisible(false);
                    setSelectedCredit(null);
                    editForm.resetFields();
                  }}
                >
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            Payment History - {selectedCredit?.customerName || 'Unknown Customer'}
          </Space>
        }
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedCredit(null);
          setPaymentHistory([]);
        }}
        footer={[
          <Button 
            key="close" 
            onClick={() => {
              setHistoryModalVisible(false);
              setSelectedCredit(null);
              setPaymentHistory([]);
            }}
          >
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedCredit && (
          <div>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              <Text strong>Credit Summary:</Text>
              <Row gutter={16}>
                <Col span={8}>
                  <Text>Total: {formatCurrency(selectedCredit.totalAmount)}</Text>
                </Col>
                <Col span={8}>
                  <Text>Paid: {formatCurrency(selectedCredit.amountPaid)}</Text>
                </Col>
                <Col span={8}>
                  <Text>Balance: {formatCurrency(selectedCredit.balanceDue)}</Text>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text>Shop: {getShopDisplayName(selectedCredit.shopId)}</Text>
                </Col>
                <Col span={12}>
                  <Text>Cashier: {String(selectedCredit.cashierName || 'N/A')}</Text>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text>Customer: {String(selectedCredit.customerName)}</Text>
                </Col>
                <Col span={12}>
                  <Text>Phone: {String(selectedCredit.customerPhone || 'N/A')}</Text>
                </Col>
              </Row>
            </Space>
            
            <Table
              columns={historyColumns}
              dataSource={paymentHistory}
              rowKey="_id"
              pagination={{ pageSize: 5 }}
              locale={{ emptyText: 'No payment history found' }}
              size="small"
              summary={() => (
                <Table.Summary>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong>Total Collected:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Text strong type="success">
                        {formatCurrency(paymentHistory.reduce((sum, payment) => sum + (payment.amount || 0), 0))}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} colSpan={3}></Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CreditManagement;