// src/pages/Admin/CashierManagement.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Table, 
  Button, 
  Modal, 
  Form, 
  Input, 
  message,
  Space,
  Typography,
  Card,
  Alert,
  Tabs,
  Row,
  Col,
  Statistic,
  Tag,
  Progress,
  DatePicker,
  Select,
  Tooltip,
  Spin,
  Empty,
  Badge,
  Divider,
  List,
  Avatar,
  Switch
} from 'antd';
import { 
  UserAddOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  BarChartOutlined,
  TeamOutlined,
  ShopOutlined,
  SaveOutlined,
  StarOutlined,
  SwapOutlined,
  ReloadOutlined,
  CreditCardOutlined,
  RiseOutlined,
  FallOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { transactionAPI, creditAPI, unifiedAPI } from '../../services/api';
import { CalculationUtils } from '../../utils/calculationUtils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { confirm } = Modal;
const { Option } = Select;

// Helper function for alpha color
const alpha = (color, opacity) => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// ==================== DEFAULT STATS ====================
const getDefaultCashierStats = () => ({
  totalRevenue: 0,
  totalCost: 0,
  totalProfit: 0,
  totalTransactions: 0,
  totalItemsSold: 0,
  profitMargin: 0,
  creditSalesCount: 0,
  totalCreditAmount: 0,
  outstandingCredit: 0,
  cashierCredits: [],
  dailyPerformance: [],
  topProducts: []
});

// ==================== CASHIER ANALYTICS COMPONENT ====================
const CashierAnalytics = ({ cashier, transactions, credits, loading }) => {
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'days'),
    dayjs()
  ]);
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedShopFilter, setSelectedShopFilter] = useState('all');

  const assignedShops = useMemo(() => {
    if (!cashier) return [];
    return cashier.assignedShops || [];
  }, [cashier]);

  const cashierStats = useMemo(() => {
    if (!cashier || !transactions || !Array.isArray(transactions)) {
      return getDefaultCashierStats();
    }

    let cashierTransactions = transactions.filter(t => 
      t.cashierName === cashier.name || 
      t.cashierId === cashier._id ||
      t.cashierId?._id === cashier._id
    );

    if (selectedShopFilter !== 'all') {
      cashierTransactions = cashierTransactions.filter(t => 
        t.shop === selectedShopFilter || 
        t.shopId === selectedShopFilter ||
        t.shop?._id === selectedShopFilter ||
        t.shopId?._id === selectedShopFilter
      );
    }

    const filteredTransactions = cashierTransactions.filter(t => {
      if (!dateRange || dateRange.length !== 2) return true;
      const transactionDate = dayjs(t.saleDate || t.createdAt);
      const startDate = dateRange[0];
      const endDate = dateRange[1];
      return transactionDate.isAfter(startDate.subtract(1, 'day')) && 
             transactionDate.isBefore(endDate.add(1, 'day'));
    });

    if (filteredTransactions.length === 0) {
      return getDefaultCashierStats();
    }

    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const totalCost = filteredTransactions.reduce((sum, t) => sum + (t.cost || 0), 0);
    const totalProfit = CalculationUtils.calculateProfit(totalRevenue, totalCost);
    const totalTransactions = filteredTransactions.length;
    const totalItemsSold = filteredTransactions.reduce((sum, t) => sum + (t.itemsCount || 0), 0);
    const profitMargin = CalculationUtils.calculateProfitMargin(totalRevenue, totalProfit);

    const cashierCredits = credits?.filter(credit => 
      credit.cashierId === cashier._id || 
      credit.cashierName === cashier.name ||
      credit.cashierId?._id === cashier._id
    ) || [];
    
    const creditSales = filteredTransactions.filter(t => t.paymentMethod === 'credit' || t.isCreditTransaction);
    const totalCreditAmount = creditSales.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const outstandingCredit = cashierCredits
      .filter(credit => credit.status !== 'paid')
      .reduce((sum, credit) => sum + (credit.balanceDue || 0), 0);

    const dailyPerformance = {};
    filteredTransactions.forEach(t => {
      const date = dayjs(t.saleDate || t.createdAt).format('YYYY-MM-DD');
      if (!dailyPerformance[date]) {
        dailyPerformance[date] = {
          date,
          revenue: 0,
          transactions: 0,
          profit: 0,
          itemsSold: 0,
          creditSales: 0,
          creditAmount: 0,
          shopName: t.shopName || 'Unknown'
        };
      }
      dailyPerformance[date].revenue += t.totalAmount || 0;
      dailyPerformance[date].transactions += 1;
      dailyPerformance[date].profit += t.profit || 0;
      dailyPerformance[date].itemsSold += t.itemsCount || 0;
      
      if (t.paymentMethod === 'credit' || t.isCreditTransaction) {
        dailyPerformance[date].creditSales += 1;
        dailyPerformance[date].creditAmount += t.totalAmount || 0;
      }
    });

    const productSales = {};
    filteredTransactions.forEach(t => {
      t.items?.forEach(item => {
        const productName = item.productName || 'Unknown Product';
        if (!productSales[productName]) {
          productSales[productName] = {
            name: productName,
            quantity: 0,
            revenue: 0,
            profit: 0
          };
        }
        productSales[productName].quantity += item.quantity || 1;
        productSales[productName].revenue += item.totalPrice || 0;
        productSales[productName].profit += item.profit || 0;
      });
    });

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      totalTransactions,
      totalItemsSold,
      profitMargin,
      creditSalesCount: creditSales.length,
      totalCreditAmount,
      outstandingCredit,
      cashierCredits,
      dailyPerformance: Object.values(dailyPerformance).sort((a, b) => 
        dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
      ),
      topProducts: Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      period: {
        start: dateRange[0]?.format('YYYY-MM-DD'),
        end: dateRange[1]?.format('YYYY-MM-DD')
      }
    };
  }, [cashier, transactions, credits, dateRange, selectedShopFilter]);

  const getProfitColor = (profit) => profit >= 0 ? '#3f8600' : '#cf1322';
  const getProfitIcon = (profit) => profit >= 0 ? <RiseOutlined /> : <FallOutlined />;
  const formatCurrency = (amount) => CalculationUtils.formatCurrency(amount);

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
    const now = dayjs();
    let startDate;
    switch (value) {
      case 'today': startDate = now.startOf('day'); break;
      case '7d': startDate = now.subtract(7, 'days'); break;
      case '30d': startDate = now.subtract(30, 'days'); break;
      case '90d': startDate = now.subtract(90, 'days'); break;
      default: startDate = now.subtract(7, 'days');
    }
    setDateRange([startDate, now]);
  };

  if (!cashier) {
    return (
      <Card>
        <Empty description="Select a cashier to view analytics" />
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Space>
              <Avatar size="large" style={{ backgroundColor: '#1890ff' }}>
                {cashier.name?.charAt(0)?.toUpperCase()}
              </Avatar>
              <div>
                <Title level={4} style={{ margin: 0 }}>{cashier.name}</Title>
                <Text type="secondary">{cashier.email}</Text>
                <div>
                  <Tag color={cashier.status === 'active' ? 'green' : 'red'}>
                    {cashier.status?.toUpperCase()}
                  </Tag>
                  {cashier.assignedShops && cashier.assignedShops.length > 1 && (
                    <Tag color="purple" icon={<SwapOutlined />}>Multi-Shop Access</Tag>
                  )}
                </div>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space style={{ float: 'right' }} wrap>
              {assignedShops.length > 1 && (
                <>
                  <Text strong>Shop:</Text>
                  <Select 
                    value={selectedShopFilter}
                    onChange={setSelectedShopFilter}
                    style={{ width: 150 }}
                  >
                    <Option value="all">All Shops</Option>
                    {assignedShops.map(shop => (
                      <Option key={shop.shopId || shop._id} value={shop.shopId || shop._id}>
                        {shop.name || shop.shopName}
                      </Option>
                    ))}
                  </Select>
                </>
              )}
              <Text strong>Time:</Text>
              <Select value={timeRange} onChange={handleTimeRangeChange} style={{ width: 120 }}>
                <Option value="today">Today</Option>
                <Option value="7d">Last 7 Days</Option>
                <Option value="30d">Last 30 Days</Option>
                <Option value="90d">Last 90 Days</Option>
                <Option value="custom">Custom</Option>
              </Select>
              {timeRange === 'custom' && (
                <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />
              )}
            </Space>
          </Col>
        </Row>
        {selectedShopFilter !== 'all' && (
          <div style={{ marginTop: 8 }}>
            <Tag color="blue">
              Filtering by: {assignedShops.find(s => (s.shopId || s._id) === selectedShopFilter)?.name || 'Selected Shop'}
            </Tag>
          </div>
        )}
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={cashierStats.totalRevenue}
              formatter={(value) => `KES ${value?.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              valueStyle={{ color: '#1890ff' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {cashierStats.totalTransactions} transactions
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Profit"
              value={cashierStats.totalProfit}
              formatter={(value) => `KES ${value?.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              valueStyle={{ color: getProfitColor(cashierStats.totalProfit) }}
              prefix={getProfitIcon(cashierStats.totalProfit)}
            />
            <Progress 
              percent={Math.min(100, Math.max(0, cashierStats.profitMargin))}
              size="small"
              format={percent => `${(percent || 0).toFixed(1)}%`}
              status={cashierStats.profitMargin >= 0 ? 'normal' : 'exception'}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Credit Sales"
              value={cashierStats.totalCreditAmount || 0}
              formatter={(value) => `KES ${value?.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              valueStyle={{ color: '#faad14' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {cashierStats.creditSalesCount || 0} credit transactions
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Outstanding Credit"
              value={cashierStats.outstandingCredit || 0}
              formatter={(value) => `KES ${value?.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              valueStyle={{ color: '#cf1322' }}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Unpaid credit balance
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Credit Analysis" size="small">
            {cashierStats.cashierCredits?.length > 0 ? (
              <List
                dataSource={cashierStats.cashierCredits.slice(0, 5)}
                renderItem={credit => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<CreditCardOutlined />} />}
                      title={
                        <Space>
                          <Text strong>{credit.customerName || 'Unknown Customer'}</Text>
                          <Tag color={credit.status === 'paid' ? 'green' : 'orange'}>
                            {credit.status?.toUpperCase()}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>Total: {formatCurrency(credit.totalAmount)}</div>
                          <div>Paid: {formatCurrency(credit.amountPaid)}</div>
                          <div>Balance: {formatCurrency(credit.balanceDue)}</div>
                          {credit.dueDate && (
                            <div>Due: {dayjs(credit.dueDate).format('DD/MM/YYYY')}</div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No credit data available" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top Selling Products" size="small">
            {cashierStats.topProducts?.length > 0 ? (
              <List
                dataSource={cashierStats.topProducts}
                renderItem={(product, index) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Badge count={index + 1} offset={[-5, 5]} color={index < 3 ? '#1890ff' : '#d9d9d9'}>
                          <Avatar size="small">{product.name.charAt(0).toUpperCase()}</Avatar>
                        </Badge>
                      }
                      title={product.name}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">Sold: {product.quantity} units</Text>
                          <Text strong>Revenue: {formatCurrency(product.revenue)}</Text>
                          <Text style={{ color: getProfitColor(product.profit) }}>
                            Profit: {formatCurrency(product.profit)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No product sales data available" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Daily Performance" style={{ marginTop: 16 }}>
        {cashierStats.dailyPerformance?.length > 0 ? (
          <List
            dataSource={cashierStats.dailyPerformance}
            renderItem={day => (
              <List.Item>
                <List.Item.Meta
                  avatar={<CalendarOutlined style={{ fontSize: '20px', color: '#1890ff' }} />}
                  title={
                    <Space>
                      <Text strong>{dayjs(day.date).format('DD MMM YYYY')}</Text>
                      <Tag color="blue">{day.transactions} transactions</Tag>
                      {day.creditSales > 0 && <Tag color="orange">{day.creditSales} credit</Tag>}
                    </Space>
                  }
                  description={
                    <Row gutter={16}>
                      <Col span={6}>
                        <Text strong>Revenue: </Text>
                        <Text style={{ color: '#1890ff' }}>{formatCurrency(day.revenue)}</Text>
                      </Col>
                      <Col span={6}>
                        <Text strong>Profit: </Text>
                        <Text style={{ color: getProfitColor(day.profit) }}>{formatCurrency(day.profit)}</Text>
                      </Col>
                      <Col span={6}>
                        <Text strong>Items: </Text>
                        <Text>{day.itemsSold}</Text>
                      </Col>
                      <Col span={6}>
                        <Text strong>Credit: </Text>
                        <Text style={{ color: '#faad14' }}>{formatCurrency(day.creditAmount)}</Text>
                      </Col>
                    </Row>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="No daily performance data available" />
        )}
      </Card>
    </div>
  );
};

// ==================== MAIN CASHIER MANAGEMENT COMPONENT ====================
const CashierManagement = () => {
  const [cashiers, setCashiers] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isShopAssignmentVisible, setIsShopAssignmentVisible] = useState(false);
  const [editingCashier, setEditingCashier] = useState(null);
  const [selectedCashierForAssignment, setSelectedCashierForAssignment] = useState(null);
  const [connectionError, setConnectionError] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [loading, setLoading] = useState({
    table: false,
    form: false,
    action: false,
    analytics: false,
    assignment: false
  });
  const [activeTab, setActiveTab] = useState('cashiers');
  const [selectedCashier, setSelectedCashier] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [credits, setCredits] = useState([]);
  const [availableShops, setAvailableShops] = useState([]);
  const [assignedShopIds, setAssignedShopIds] = useState([]);
  const [shopAssignmentError, setShopAssignmentError] = useState(null);
  
  const [form] = Form.useForm();
  const cashiersCache = useRef({
    data: [],
    lastFetch: null
  });

  // In CashierManagement.js, update the createApiInstance function
const createApiInstance = () => {
  const instance = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'https://back-pos.vercel.app',
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Add auth token if available
  const token = localStorage.getItem('sessionToken') || 
                localStorage.getItem('authToken') ||
                localStorage.getItem('adminToken');
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Add response interceptor for better error handling
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        setConnectionError(true);
        setErrorDetails('Network error - cannot reach server');
        message.error('Cannot connect to server. Please check if the backend is running.');
      } else if (error.response?.status === 401) {
        message.error('Session expired. Please login again.');
        window.location.href = '/login';
      } else if (error.response?.status === 500) {
        const errorMsg = error.response?.data?.message || 'Internal server error';
        setErrorDetails(errorMsg);
        message.error('Server error: ' + errorMsg);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

  // Fetch cashiers with fallback
  const fetchCashiers = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache
      const cacheValid = cashiersCache.current.lastFetch && 
                       (Date.now() - cashiersCache.current.lastFetch < 30000);
      
      if (cacheValid && !forceRefresh && cashiersCache.current.data.length > 0) {
        setCashiers(cashiersCache.current.data);
        return;
      }

      setLoading(prev => ({ ...prev, table: true }));
      setConnectionError(false);
      setErrorDetails(null);
      
      const api = createApiInstance();
      
      // Try to get cashiers
      const response = await api.get('/api/cashiers');
      
      let cashiersData = [];
      
      // Handle different response formats
      if (response.data) {
        if (Array.isArray(response.data.data)) {
          cashiersData = response.data.data;
        } else if (Array.isArray(response.data)) {
          cashiersData = response.data;
        } else if (response.data.cashiers && Array.isArray(response.data.cashiers)) {
          cashiersData = response.data.cashiers;
        } else {
          // Try to extract array from response
          const dataKeys = Object.keys(response.data);
          for (const key of dataKeys) {
            if (Array.isArray(response.data[key])) {
              cashiersData = response.data[key];
              break;
            }
          }
        }
      }
      
      // Ensure we have an array
      if (!Array.isArray(cashiersData)) {
        cashiersData = [];
      }
      
      // Enhance cashiers with shop info
      const enhancedCashiers = cashiersData.map(cashier => ({
        ...cashier,
        assignedShops: cashier.assignedShops || [],
        activeAssignedShops: (cashier.assignedShops || [])
          .filter(a => a.isActive !== false),
        hasMultipleShops: (cashier.assignedShops || [])
          .filter(a => a.isActive !== false).length > 1
      }));
      
      // Update cache
      cashiersCache.current = {
        data: enhancedCashiers,
        lastFetch: Date.now()
      };
      
      setCashiers(enhancedCashiers);
      
      if (enhancedCashiers.length === 0) {
        message.info('No cashiers found. Add your first cashier!');
      }
      
    } catch (error) {
      console.error('Fetch cashiers error:', error);
      
      // Use cached data if available
      if (cashiersCache.current.data.length > 0) {
        setCashiers(cashiersCache.current.data);
        message.warning('Using cached data - could not refresh from server');
        return;
      }
      
      // Try fallback: fetch from alternative endpoint
      try {
        const api = createApiInstance();
        const fallbackResponse = await api.get('/api/cashiers/list');
        if (fallbackResponse.data && Array.isArray(fallbackResponse.data)) {
          setCashiers(fallbackResponse.data);
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
      
      // Show error
      const errorMsg = error.response?.data?.message || error.message || 'Failed to fetch cashiers';
      setErrorDetails(errorMsg);
      message.error(errorMsg);
      setCashiers([]);
    } finally {
      setLoading(prev => ({ ...prev, table: false }));
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async (cashierId = null) => {
    try {
      setLoading(prev => ({ ...prev, analytics: true }));
      const params = {};
      if (cashierId) params.cashierId = cashierId;
      
      let transactionsData;
      try {
        transactionsData = await unifiedAPI.getCombinedTransactions(params);
      } catch (unifiedError) {
        console.warn('Unified API failed, trying transactionAPI directly...', unifiedError);
        const rawTransactions = await transactionAPI.getAll(params);
        transactionsData = {
          transactions: rawTransactions,
          salesWithProfit: rawTransactions
        };
      }
      
      const salesData = transactionsData.salesWithProfit || transactionsData.transactions || [];
      const processedData = CalculationUtils.processComprehensiveData({
        transactions: salesData,
        expenses: [],
        credits: [],
        products: [],
        shops: [],
        cashiers: []
      }, null);
      
      setTransactions(processedData.salesWithProfit || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      message.warning('Failed to load transaction data');
      setTransactions([]);
    } finally {
      setLoading(prev => ({ ...prev, analytics: false }));
    }
  }, []);

  // Fetch credits
  const fetchCredits = useCallback(async (cashierId = null) => {
    try {
      const params = {};
      if (cashierId) params.cashierId = cashierId;
      
      const creditsData = await creditAPI.getAll(params);
      
      let creditsArray = [];
      if (creditsData && Array.isArray(creditsData.credits)) {
        creditsArray = creditsData.credits;
      } else if (creditsData && Array.isArray(creditsData.creditTransactions)) {
        creditsArray = creditsData.creditTransactions;
      } else if (creditsData && Array.isArray(creditsData.data)) {
        creditsArray = creditsData.data;
      } else if (Array.isArray(creditsData)) {
        creditsArray = creditsData;
      }
      
      setCredits(creditsArray);
    } catch (error) {
      console.error('Error fetching credits:', error);
      message.warning('Failed to load credit data');
      setCredits([]);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCashiers();
  }, [fetchCashiers]);

  // Fetch analytics when cashier is selected
  useEffect(() => {
    if (activeTab === 'performance' && selectedCashier) {
      const cashierId = selectedCashier._id;
      Promise.all([
        fetchTransactions(cashierId),
        fetchCredits(cashierId)
      ]);
    }
  }, [activeTab, selectedCashier, fetchTransactions, fetchCredits]);

  const handleAddCashier = () => {
    if (connectionError) {
      message.error('Cannot connect to server. Please check if the backend is running.');
      return;
    }
    form.resetFields();
    setEditingCashier(null);
    setIsModalVisible(true);
  };

  const handleEditCashier = (cashier) => {
    form.setFieldsValue({
      name: cashier.name,
      email: cashier.email,
      phone: cashier.phone
    });
    setEditingCashier(cashier);
    setIsModalVisible(true);
  };

  const handleViewCashier = (cashier) => {
    setEditingCashier(cashier);
    setIsViewModalVisible(true);
  };

  const handleViewAnalytics = (cashier) => {
    setSelectedCashier(cashier);
    setActiveTab('performance');
    setTimeout(() => {
      fetchTransactions(cashier._id);
      fetchCredits(cashier._id);
    }, 100);
  };

  // Shop Assignment Handlers
  const handleOpenShopAssignment = async (cashier) => {
    setSelectedCashierForAssignment(cashier);
    setShopAssignmentError(null);
    setLoading(prev => ({ ...prev, assignment: true }));
    setIsShopAssignmentVisible(true);
    
    try {
      const api = createApiInstance();
      const response = await api.get(`/api/cashiers/${cashier._id}/available-shops`);
      
      if (response.data.success) {
        const shops = response.data.data.shops || [];
        setAvailableShops(shops);
        const assignedIds = shops
          .filter(shop => shop.isAssigned)
          .map(shop => shop._id);
        setAssignedShopIds(assignedIds);
      } else {
        message.error(response.data.message || 'Failed to load shops');
        setShopAssignmentError('Failed to load shop data');
      }
    } catch (error) {
      console.error('Error loading shops:', error);
      setShopAssignmentError('Failed to load shops. Please try again.');
      message.error('Failed to load shop assignment data');
    } finally {
      setLoading(prev => ({ ...prev, assignment: false }));
    }
  };

  const handleSaveShopAssignment = async () => {
    if (!selectedCashierForAssignment) return;
    
    setLoading(prev => ({ ...prev, assignment: true }));
    setShopAssignmentError(null);
    
    try {
      const api = createApiInstance();
      
      const currentAssigned = availableShops
        .filter(shop => shop.isAssigned)
        .map(shop => shop._id);
      
      const shopsToAssign = assignedShopIds.filter(id => !currentAssigned.includes(id));
      const shopsToRemove = currentAssigned.filter(id => !assignedShopIds.includes(id));
      
      if (shopsToAssign.length > 0) {
        await api.post(`/api/cashiers/${selectedCashierForAssignment._id}/assign-shops`, {
          shopIds: shopsToAssign,
          action: 'assign',
          notes: 'Assigned by admin'
        });
      }
      
      if (shopsToRemove.length > 0) {
        await api.post(`/api/cashiers/${selectedCashierForAssignment._id}/assign-shops`, {
          shopIds: shopsToRemove,
          action: 'remove',
          notes: 'Removed by admin'
        });
      }
      
      message.success('Shop assignments updated successfully');
      setIsShopAssignmentVisible(false);
      fetchCashiers(true);
      
    } catch (error) {
      console.error('Error updating shop assignments:', error);
      const errorMsg = error.response?.data?.message || 'Failed to update shop assignments';
      setShopAssignmentError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(prev => ({ ...prev, assignment: false }));
    }
  };

  const handleToggleShopAssignment = (shopId, checked) => {
    if (checked) {
      setAssignedShopIds([...assignedShopIds, shopId]);
    } else {
      setAssignedShopIds(assignedShopIds.filter(id => id !== shopId));
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(prev => ({ ...prev, form: true }));
      
      const processedValues = {
        name: values.name.trim(),
        email: values.email.toLowerCase().trim(),
        phone: values.phone,
        ...(editingCashier ? {} : { password: values.password })
      };

      const api = createApiInstance();
      
      if (editingCashier) {
        const response = await api.patch(`/api/cashiers/${editingCashier._id}`, processedValues);
        if (response.data.success) {
          message.success('Cashier updated successfully');
          setIsModalVisible(false);
          fetchCashiers(true);
        } else {
          message.error(response.data.message || 'Failed to update cashier');
        }
      } else {
        const response = await api.post('/api/cashiers', processedValues);
        if (response.data.success) {
          message.success('Cashier added successfully');
          setIsModalVisible(false);
          fetchCashiers(true);
        } else {
          message.error(response.data.message || 'Failed to add cashier');
        }
      }
    } catch (error) {
      if (error.response && error.response.status === 400 && 
          error.response.data.error && error.response.data.error.includes('email')) {
        message.error('Cashier with this email already exists');
      } else {
        const errorMsg = error.response?.data?.message || error.message || 'Operation failed';
        message.error(errorMsg);
      }
    } finally {
      setLoading(prev => ({ ...prev, form: false }));
    }
  };

  const handleDeleteCashier = async (id) => {
    confirm({
      title: 'Are you sure you want to delete this cashier?',
      content: 'This action cannot be undone.',
      okText: 'Yes, delete',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          setLoading(prev => ({ ...prev, action: true }));
          const api = createApiInstance();
          await api.delete(`/api/cashiers/${id}`);
          message.success('Cashier deleted successfully');
          fetchCashiers(true);
        } catch (error) {
          const errorMsg = error.response?.data?.message || 'Failed to delete cashier';
          message.error(errorMsg);
        } finally {
          setLoading(prev => ({ ...prev, action: false }));
        }
      }
    });
  };

  const retryConnection = () => {
    setConnectionError(false);
    setErrorDetails(null);
    fetchCashiers(true);
    if (activeTab === 'performance' && selectedCashier) {
      fetchTransactions(selectedCashier._id);
      fetchCredits(selectedCashier._id);
    }
  };

  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name',
      sorter: (a, b) => a.name?.localeCompare(b.name || '') || 0,
      render: (name, record) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
            {name?.charAt(0)?.toUpperCase() || '?'}
          </Avatar>
          <Text strong>{name || 'Unknown'}</Text>
        </Space>
      )
    },
    { 
      title: 'Email', 
      dataIndex: 'email', 
      key: 'email',
      sorter: (a, b) => a.email?.localeCompare(b.email || '') || 0
    },
    { 
      title: 'Phone', 
      dataIndex: 'phone', 
      key: 'phone',
      sorter: (a, b) => a.phone?.localeCompare(b.phone || '') || 0
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status?.toUpperCase() || 'UNKNOWN'}
        </Tag>
      )
    },
    { 
      title: 'Assigned Shops', 
      key: 'assignedShops',
      render: (_, record) => {
        const activeShops = (record.assignedShops || [])
          .filter(a => a.isActive !== false);
        
        if (activeShops.length === 0) {
          return <Tag color="default">No shops assigned</Tag>;
        }
        
        return (
          <Space direction="vertical" size={2}>
            {activeShops.slice(0, 3).map((shop, index) => (
              <Tag key={index} color="blue" style={{ margin: 0 }}>
                {shop.shopName || 'Unknown Shop'}
              </Tag>
            ))}
            {activeShops.length > 3 && (
              <Tag color="default">+{activeShops.length - 3} more</Tag>
            )}
            {record.shopId && (
              <Tag color="green" size="small" style={{ marginTop: 4 }}>
                Primary: {record.shopName}
              </Tag>
            )}
          </Space>
        );
      }
    },
    { 
      title: 'Last Login', 
      dataIndex: 'lastLogin', 
      key: 'lastLogin',
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY HH:mm') : 'Never',
      sorter: (a, b) => new Date(a.lastLogin || 0) - new Date(b.lastLogin || 0)
    },
    { 
      title: 'Actions', 
      key: 'actions',
      width: 380,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="View Analytics">
            <Button 
              type="primary" 
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => handleViewAnalytics(record)}
              disabled={loading.action || connectionError}
            >
              Analytics
            </Button>
          </Tooltip>
          <Tooltip title="Manage Shop Access">
            <Button 
              type="default" 
              size="small"
              icon={<ShopOutlined />}
              onClick={() => handleOpenShopAssignment(record)}
              disabled={loading.action || connectionError}
              style={{ color: '#1890ff', borderColor: '#1890ff' }}
            >
              Shops
            </Button>
          </Tooltip>
          <Button 
            type="default" 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewCashier(record)}
            disabled={loading.action || connectionError}
          >
            View
          </Button>
          <Button 
            type="default" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditCashier(record)}
            disabled={loading.action || connectionError}
          >
            Edit
          </Button>
          <Button 
            type="primary" 
            danger
            size="small"
            icon={<DeleteOutlined />} 
            onClick={() => handleDeleteCashier(record._id)}
            disabled={loading.action || connectionError}
          >
            Delete
          </Button>
        </Space>
      )
    },
  ];

  return (
    <div className="management-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2}>Cashier Management</Title>
        <Space>
          <Button 
            icon={<ReloadOutlined />}
            onClick={() => fetchCashiers(true)}
            loading={loading.table}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<UserAddOutlined />} 
            onClick={handleAddCashier}
            loading={loading.table}
            disabled={connectionError}
          >
            Add Cashier
          </Button>
        </Space>
      </div>
      
      {connectionError && (
        <Alert
          message="Connection Error"
          description={
            <div>
              <p>Cannot connect to the server.</p>
              {errorDetails && <p style={{ fontSize: '12px', color: '#666' }}>Error: {errorDetails}</p>}
              <p style={{ fontSize: '12px', marginTop: 8 }}>
                Please check:
                <ul>
                  <li>Backend server is running</li>
                  <li>API URL is correct: {process.env.REACT_APP_API_URL || 'https://back-pos.vercel.app'}</li>
                  <li>You have proper authentication</li>
                </ul>
              </p>
            </div>
          }
          type="error"
          showIcon
          closable
          onClose={() => {
            setConnectionError(false);
            setErrorDetails(null);
          }}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" type="primary" onClick={retryConnection}>
              Retry
            </Button>
          }
        />
      )}
      
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        style={{ marginTop: 16 }}
      >
        <TabPane 
          tab={
            <span>
              <TeamOutlined />
              Cashier List
              <Badge count={cashiers.length} style={{ marginLeft: 8 }} />
            </span>
          } 
          key="cashiers"
        >
          <Card>
            <Table 
              columns={columns} 
              dataSource={cashiers} 
              rowKey="_id"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              bordered
              loading={loading.table}
              scroll={{ x: true }}
              locale={{
                emptyText: connectionError ? 'Cannot connect to server' : 'No cashiers found'
              }}
            />
          </Card>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <BarChartOutlined />
              Performance Analytics
              {selectedCashier && (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {selectedCashier.name}
                </Tag>
              )}
            </span>
          } 
          key="performance"
        >
          <Spin spinning={loading.analytics}>
            {selectedCashier ? (
              <CashierAnalytics 
                cashier={selectedCashier}
                transactions={transactions}
                credits={credits}
                loading={loading.analytics}
              />
            ) : (
              <Card>
                <Empty 
                  description="Please select a cashier to view analytics" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button 
                    type="primary" 
                    onClick={() => setActiveTab('cashiers')}
                  >
                    Select Cashier
                  </Button>
                </Empty>
              </Card>
            )}
          </Spin>
        </TabPane>
      </Tabs>

      {/* Add/Edit Cashier Modal */}
      <Modal
        title={editingCashier ? "Edit Cashier" : "Add New Cashier"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item 
            name="name" 
            label="Full Name" 
            rules={[
              { required: true, message: 'Please input cashier name' },
              { min: 2, message: 'Minimum 2 characters' },
              { max: 50, message: 'Maximum 50 characters' }
            ]}
          >
            <Input placeholder="Enter cashier name" disabled={loading.form} />
          </Form.Item>
          
          <Form.Item 
            name="email" 
            label="Email" 
            rules={[
              { required: true, message: 'Please input email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input placeholder="Enter email" disabled={loading.form || !!editingCashier} />
          </Form.Item>
          
          <Form.Item 
            name="phone" 
            label="Phone Number" 
            rules={[
              { required: true, message: 'Please input phone number' },
              { pattern: /^[0-9+\-\s()]{10,}$/, message: 'Please enter a valid phone number' }
            ]}
          >
            <Input placeholder="Enter phone number" disabled={loading.form} />
          </Form.Item>
          
          {!editingCashier && (
            <Form.Item 
              name="password" 
              label="Password" 
              rules={[
                { required: true, message: 'Please input password' },
                { min: 6, message: 'Password must be at least 6 characters' }
              ]}
              extra="Admin sets permanent password for cashier"
            >
              <Input.Password placeholder="Enter password" disabled={loading.form} />
            </Form.Item>
          )}
          
          <div style={{ textAlign: 'right' }}>
            <Button 
              onClick={() => setIsModalVisible(false)} 
              style={{ marginRight: 8 }}
              disabled={loading.form}
            >
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit"
              loading={loading.form}
            >
              {editingCashier ? 'Update Cashier' : 'Add Cashier'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* View Cashier Modal */}
      <Modal
        title="Cashier Details"
        open={isViewModalVisible}
        onCancel={() => setIsViewModalVisible(false)}
        footer={[<Button key="close" onClick={() => setIsViewModalVisible(false)}>Close</Button>]}
        width={500}
      >
        {editingCashier && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Avatar size={64} style={{ backgroundColor: '#1890ff', marginBottom: 8 }}>
                  {editingCashier.name?.charAt(0)?.toUpperCase() || '?'}
                </Avatar>
                <Title level={4} style={{ margin: 0 }}>{editingCashier.name || 'Unknown'}</Title>
                <Text type="secondary">{editingCashier.email}</Text>
              </div>
              
              <Divider />
              
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Phone:</Text>
                  <br />
                  <Text>{editingCashier.phone || 'Not provided'}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Status:</Text>
                  <br />
                  <Tag color={editingCashier.status === 'active' ? 'green' : 'red'}>
                    {editingCashier.status?.toUpperCase() || 'UNKNOWN'}
                  </Tag>
                </Col>
              </Row>
              
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <Text strong>Primary Shop:</Text>
                  <br />
                  <Text>{editingCashier.shopName || 'Not assigned'}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Role:</Text>
                  <br />
                  <Tag color="blue">{editingCashier.role?.toUpperCase() || 'CASHIER'}</Tag>
                </Col>
              </Row>

              <div style={{ marginTop: 8 }}>
                <Text strong>Assigned Shops:</Text>
                <br />
                {(editingCashier.assignedShops || []).filter(a => a.isActive !== false).length > 0 ? (
                  <Space direction="vertical" size={2} style={{ marginTop: 4 }}>
                    {(editingCashier.assignedShops || [])
                      .filter(a => a.isActive !== false)
                      .map((shop, index) => (
                        <Tag key={index} color="blue">
                          {shop.shopName || 'Unknown Shop'}
                          {editingCashier.shopId === shop.shopId && ' (Primary)'}
                        </Tag>
                      ))}
                  </Space>
                ) : (
                  <Text type="secondary">No shops assigned</Text>
                )}
              </div>
              
              {editingCashier.lastLogin && (
                <div style={{ marginTop: 8 }}>
                  <Text strong>Last Login:</Text>
                  <br />
                  <Text>{new Date(editingCashier.lastLogin).toLocaleString()}</Text>
                </div>
              )}
              
              <div style={{ marginTop: 8 }}>
                <Text strong>Member Since:</Text>
                <br />
                <Text>{new Date(editingCashier.createdAt).toLocaleDateString()}</Text>
              </div>
            </Space>
          </div>
        )}
      </Modal>

      {/* Shop Assignment Modal */}
      <Modal
        title={
          <Space>
            <ShopOutlined />
            Manage Shop Access
            {selectedCashierForAssignment && (
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {selectedCashierForAssignment.name}
              </Tag>
            )}
          </Space>
        }
        open={isShopAssignmentVisible}
        onCancel={() => {
          setIsShopAssignmentVisible(false);
          setShopAssignmentError(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsShopAssignmentVisible(false);
            setShopAssignmentError(null);
          }}>
            Cancel
          </Button>,
          <Button 
            key="save" 
            type="primary" 
            loading={loading.assignment}
            onClick={handleSaveShopAssignment}
            icon={<SaveOutlined />}
          >
            Save Changes
          </Button>
        ]}
        width={700}
      >
        {shopAssignmentError && (
          <Alert
            message="Error"
            description={shopAssignmentError}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 16 }}
            onClose={() => setShopAssignmentError(null)}
          />
        )}
        
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Text strong>Cashier:</Text>
            <Text>{selectedCashierForAssignment?.name}</Text>
            <Text type="secondary">({selectedCashierForAssignment?.email})</Text>
          </Space>
          <br />
          <Text type="secondary">
            Select the shops this cashier should have access to. 
            Toggle the switch to assign or remove shop access.
          </Text>
        </div>
        
        <Divider />
        
        <Spin spinning={loading.assignment}>
          {availableShops.length > 0 ? (
            <div>
              <Alert
                message="Shop Assignment"
                description={
                  <span>
                    Cashier has access to <strong>{assignedShopIds.length}</strong> of {availableShops.length} shops.
                    {assignedShopIds.length === 0 && ' Currently, this cashier has no shop access.'}
                  </span>
                }
                type={assignedShopIds.length > 0 ? 'info' : 'warning'}
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <List
                dataSource={availableShops}
                renderItem={shop => {
                  const isChecked = assignedShopIds.includes(shop._id);
                  const isPrimary = shop.isPrimary;
                  
                  return (
                    <List.Item
                      actions={[
                        isPrimary && (
                          <Tag color="green" icon={<StarOutlined />}>
                            Primary
                          </Tag>
                        ),
                        <Switch
                          checked={isChecked}
                          onChange={(checked) => handleToggleShopAssignment(shop._id, checked)}
                          checkedChildren="Assigned"
                          unCheckedChildren="Remove"
                          disabled={loading.assignment}
                        />
                      ]}
                      style={{
                        backgroundColor: isChecked ? alpha('#10B981', 0.05) : 'transparent',
                        borderRadius: 4,
                        padding: '8px 12px'
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar 
                            style={{ 
                              backgroundColor: isChecked ? '#10B981' : '#d9d9d9',
                              color: 'white'
                            }}
                          >
                            {shop.name?.charAt(0)?.toUpperCase() || '?'}
                          </Avatar>
                        }
                        title={
                          <Space>
                            <Text strong>{shop.name || 'Unknown Shop'}</Text>
                            <Tag color={shop.status === 'active' ? 'green' : 'red'}>
                              {shop.status?.toUpperCase() || 'UNKNOWN'}
                            </Tag>
                            {isPrimary && <Tag color="gold">Primary</Tag>}
                          </Space>
                        }
                        description={
                          <div>
                            <div>📍 {shop.location || 'No location specified'}</div>
                            <div>🏷️ {shop.type || 'Retail'}</div>
                            {isChecked && (
                              <Text type="success" style={{ fontSize: 12 }}>
                                ✓ Access granted
                              </Text>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </div>
          ) : (
            <Empty 
              description="No active shops available to assign" 
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default CashierManagement;