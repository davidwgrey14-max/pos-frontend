// src/pages/Manager/ManagerDashboard.jsx - UPDATED to fetch exactly like AdminDashboard
import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout, Card, Row, Col, Statistic, Typography, Tag, Space,
  Button, Spin, Alert, Divider, List, Avatar,
  Tabs, Input, Modal, Form, message, Descriptions,
  Progress, Badge, Timeline, DatePicker, Table, Select,
  Switch, Tooltip, Dropdown
} from 'antd';
import {
  ShopOutlined, UserOutlined, DollarOutlined,
  ShoppingCartOutlined, LogoutOutlined, ReloadOutlined,
  ArrowLeftOutlined, BarChartOutlined, TransactionOutlined,
  SearchOutlined, PlusOutlined, BarcodeOutlined,
  CalculatorOutlined, DeleteOutlined, ScanOutlined,
  PrinterOutlined, SafetyCertificateOutlined, QrcodeOutlined,
  ClearOutlined, CreditCardOutlined, PhoneOutlined,
  CalendarOutlined, BankOutlined, MoneyCollectOutlined,
  HistoryOutlined, WarningOutlined, CheckCircleOutlined,
  ClockCircleOutlined, TeamOutlined, ShoppingOutlined,
  EyeOutlined, FileTextOutlined, InfoCircleOutlined,
  RiseOutlined, FallOutlined, StockOutlined,
  AppstoreOutlined, PieChartOutlined, LineChartOutlined,
  ExportOutlined, FilterOutlined, WalletOutlined,
  PercentageOutlined, DashboardOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { unifiedAPI, productAPI, creditAPI, transactionAPI, expenseAPI, shopAPI } from '../../services/api';
import dayjs from 'dayjs';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

// ==================== CONFIGURATION WITH FALLBACKS ====================
const CONFIG = {
  STOCK_ALERTS: {
    LOW_STOCK_THRESHOLD: 5,
    DEAD_STOCK_DAYS: 30,
    MAX_RECENT_TRANSACTIONS: 20
  },
  APP: {
    CURRENCY: 'KES'
  }
};

// ==================== FINANCIAL STAT CARD COMPONENT ====================
const FinancialStatCard = ({ title, value, prefix = "KES", suffix, color, icon, description, type = 'currency' }) => {
  const getColor = () => {
    if (color) return color;
    if (type === 'profit' && value > 0) return '#52c41a';
    if (type === 'profit' && value < 0) return '#ff4d4f';
    if (type === 'warning' && value > 0) return '#faad14';
    if (type === 'percentage') return '#13c2c2';
    return '#1890ff';
  };

  return (
    <Col xs={24} sm={12} md={8} lg={6} xl={4}>
      <Card 
        size="small" 
        style={{ 
          background: 'linear-gradient(135deg, #1a2332 0%, #0f172a 100%)',
          border: `1px solid ${getColor()}33`,
          borderRadius: '8px',
          textAlign: 'center',
          height: '100%'
        }}
        bodyStyle={{ padding: '12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          {icon && <span style={{ color: getColor(), marginRight: 8 }}>{icon}</span>}
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 'bold' }}>
            {title}
          </Text>
        </div>
        <Statistic
          value={value}
          prefix={prefix && type === 'currency' ? <Text style={{ color: 'white', fontSize: '10px' }}>KES</Text> : null}
          suffix={suffix || (type === 'percentage' ? '%' : null)}
          valueStyle={{ 
            color: 'white',
            fontSize: '18px',
            fontWeight: 'bold',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
          }}
          precision={type === 'percentage' ? 1 : type === 'currency' ? 0 : 0}
        />
        {description && (
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', display: 'block', marginTop: 2 }}>
            {description}
          </Text>
        )}
      </Card>
    </Col>
  );
};

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [manager, setManager] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataTimestamp, setDataTimestamp] = useState(null);
  const [shops, setShops] = useState([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: null,
    shop: 'all',
    autoRefresh: false
  });
  
  // Dashboard data state - structured like AdminDashboard
  const [dashboardData, setDashboardData] = useState({
    financialStats: {
      totalRevenue: 0,
      totalSales: 0,
      netProfit: 0,
      outstandingCredit: 0,
      totalExpenses: 0,
      grossProfit: 0,
      creditSales: 0,
      nonCreditSales: 0,
      totalCash: 0,
      totalMpesaBank: 0,
      profitMargin: 0,
      totalItemsSold: 0,
      costOfGoodsSold: 0,
      grossProfitMargin: 0,
      totalTransactions: 0,
      averageTransactionValue: 0,
      creditCollectionRate: 0,
      totalCreditGiven: 0,
      recognizedCreditRevenue: 0
    },
    businessStats: {
      totalProducts: 0,
      totalShops: 0,
      totalCashiers: 0,
      lowStockCount: 0,
      activeCredits: 0
    },
    recentTransactions: [],
    lowStockProducts: [],
    topProducts: [],
    shopPerformance: []
  });

  // Check authentication on mount
  useEffect(() => {
    const managerData = JSON.parse(localStorage.getItem('managerData') || localStorage.getItem('userData') || 'null');
    if (!managerData || managerData.role !== 'manager') {
      navigate('/cashier-login');
      return;
    }
    setManager(managerData);
    fetchDashboardData();
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    let intervalId;
    if (filters.autoRefresh) {
      intervalId = setInterval(() => {
        console.log('🔄 Auto-refreshing manager dashboard data...');
        fetchDashboardData();
      }, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [filters.autoRefresh]);

  // Fetch dashboard data - EXACTLY like AdminDashboard
  const fetchDashboardData = async (customFilters = null) => {
    const activeFilters = customFilters || filters;
    
    console.log('🚀 Fetching manager dashboard data with filters:', activeFilters);
    
    try {
      setLoading(true);
      setRefreshing(true);
      
      // Fetch shops first
      const shopsData = await shopAPI.getAll();
      console.log('🏪 Shops fetched:', shopsData?.length || 0);
      setShops(shopsData || []);

      // Build params for combined API
      const params = {};
      if (activeFilters.dateRange && activeFilters.dateRange[0] && activeFilters.dateRange[1]) {
        params.startDate = activeFilters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = activeFilters.dateRange[1].format('YYYY-MM-DD');
      }
      if (activeFilters.shop && activeFilters.shop !== 'all') {
        params.shopId = activeFilters.shop;
      }

      // Fetch combined transaction data from backend
      console.log('📡 Fetching combined data with params:', params);
      const response = await unifiedAPI.getCombinedTransactions(params);
      console.log('📊 Combined data response:', response);
      
      // Handle response properly
      let data = {};
      
      if (!response) {
        throw new Error('No response received from server');
      }
      
      // Check if response has a success property
      if (response.success === true) {
        data = response.data || response;
      } else if (response.success === false) {
        console.error('API returned error:', response.message);
        throw new Error(response.message || 'Failed to fetch data');
      } else {
        data = response;
      }

      // Process the data
      const processedData = processDashboardData(data, shopsData);
      
      setDashboardData(processedData);
      setDataTimestamp(new Date().toISOString());
      
      console.log('✅ Manager dashboard data processed successfully');
      
    } catch (error) {
      console.error('💥 Dashboard fetch failed:', error);
      message.error(error.message || 'Failed to load dashboard data');
      
      // Set default/empty data on error
      setDashboardData(prev => ({
        ...prev,
        financialStats: getDefaultStats(),
        businessStats: {
          totalProducts: 0,
          totalShops: 0,
          totalCashiers: 0,
          lowStockCount: 0,
          activeCredits: 0
        },
        recentTransactions: [],
        lowStockProducts: [],
        topProducts: [],
        shopPerformance: []
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Process dashboard data - EXACTLY like AdminDashboard
  const processDashboardData = (data, shops) => {
    const transactions = data?.salesWithProfit || data?.transactions || [];
    const financialStats = data?.financialStats || data?.summary || data?.financialStats || getDefaultStats();
    const products = data?.products || [];
    const cashiers = data?.cashiers || [];
    const credits = data?.credits || [];
    const expenses = data?.expenses || [];
    const shopPerformanceData = data?.performance?.shopPerformance || [];
    
    const shopMap = {};
    if (shops && shops.length > 0) {
      shops.forEach(shop => {
        shopMap[shop._id] = shop.name;
      });
    }

    const recentTransactions = (transactions || [])
      .slice(0, 10)
      .map(t => ({
        ...t,
        _id: t._id || t.id || `txn-${Date.now()}`,
        transactionNumber: t.transactionNumber || t._id?.toString().substring(0, 8) || 'N/A',
        saleDate: t.saleDate || t.createdAt || new Date().toISOString(),
        customerName: t.customerName || 'Walk-in',
        totalAmount: t.totalAmount || 0,
        shop: t.shopName || shopMap[t.shop] || t.shop || 'Unknown',
        profit: t.profit || 0
      }));

    const lowStockProducts = (products || [])
      .filter(p => (p.currentStock || 0) <= (p.minStockLevel || 5))
      .slice(0, 5)
      .map(p => ({
        ...p,
        _id: p._id || p.id || `prod-${Date.now()}`,
        name: p.name || 'Unknown Product',
        currentStock: p.currentStock || 0,
        minStockLevel: p.minStockLevel || 5
      }));

    let topProducts = data?.performance?.topProducts || [];
    if (!topProducts || topProducts.length === 0) {
      const productMap = {};
      (transactions || []).forEach(t => {
        t.items?.forEach(item => {
          const id = item.productId?.toString() || item.productName || 'unknown';
          if (!productMap[id]) {
            productMap[id] = { 
              name: item.productName || 'Unknown Product', 
              totalSold: 0, 
              totalRevenue: 0,
              totalProfit: 0
            };
          }
          const quantity = item.quantity || 1;
          const revenue = item.totalPrice || (item.price * quantity) || 0;
          const cost = (item.buyingPrice || 0) * quantity;
          productMap[id].totalSold += quantity;
          productMap[id].totalRevenue += revenue;
          productMap[id].totalProfit += (revenue - cost);
        });
      });
      topProducts = Object.values(productMap)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);
    }

    let shopPerformance = shopPerformanceData;
    if (!shopPerformance || shopPerformance.length === 0) {
      const shopMapPerf = {};
      (transactions || []).forEach(t => {
        const shopId = t.shop || t.shopId || 'unknown';
        if (!shopMapPerf[shopId]) {
          shopMapPerf[shopId] = { 
            name: shopMap[shopId] || t.shopName || 'Unknown Shop', 
            revenue: 0, 
            transactions: 0,
            profit: 0
          };
        }
        shopMapPerf[shopId].revenue += t.totalAmount || 0;
        shopMapPerf[shopId].transactions += 1;
        shopMapPerf[shopId].profit += t.profit || 0;
      });
      shopPerformance = Object.values(shopMapPerf)
        .sort((a, b) => b.revenue - a.revenue);
    }

    const businessStats = {
      totalProducts: products?.length || 0,
      totalShops: shops?.length || 0,
      totalCashiers: cashiers?.length || 0,
      lowStockCount: (products || []).filter(p => (p.currentStock || 0) <= (p.minStockLevel || 5)).length,
      activeCredits: (credits || []).filter(c => c.status !== 'paid' && (c.balanceDue || 0) > 0).length
    };

    // ENHANCED FINANCIAL STATS with all metrics
    const totalRevenue = financialStats.totalRevenue || 0;
    const totalSales = financialStats.totalSales || financialStats.totalRevenueCount || 0;
    const costOfGoodsSold = financialStats.costOfGoodsSold || 0;
    const grossProfit = financialStats.grossProfit || financialStats.totalProfit || 0;
    const totalExpenses = financialStats.totalExpenses || 0;
    const netProfit = financialStats.netProfit || 0;
    const totalTransactions = financialStats.totalTransactions || totalSales || 0;
    
    // Calculate derived metrics
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    // Credit metrics
    const totalCreditGiven = financialStats.totalCreditGiven || 0;
    const recognizedCreditRevenue = financialStats.recognizedCreditRevenue || 0;
    const outstandingCredit = financialStats.outstandingCredit || 0;
    const creditCollectionRate = totalCreditGiven > 0 ? (recognizedCreditRevenue / totalCreditGiven) * 100 : 0;

    const enhancedFinancialStats = {
      totalRevenue,
      totalSales,
      netProfit,
      outstandingCredit,
      totalExpenses,
      grossProfit,
      creditSales: financialStats.creditSales || 0,
      nonCreditSales: financialStats.nonCreditSales || 0,
      totalCash: financialStats.totalCash || 0,
      totalMpesaBank: financialStats.totalMpesaBank || 0,
      profitMargin,
      totalItemsSold: financialStats.totalItemsSold || 0,
      costOfGoodsSold,
      grossProfitMargin,
      totalTransactions,
      averageTransactionValue,
      creditCollectionRate,
      totalCreditGiven,
      recognizedCreditRevenue
    };

    return {
      financialStats: enhancedFinancialStats,
      businessStats,
      recentTransactions,
      lowStockProducts,
      topProducts,
      shopPerformance
    };
  };

  const getDefaultStats = () => ({
    totalRevenue: 0,
    totalSales: 0,
    netProfit: 0,
    outstandingCredit: 0,
    totalExpenses: 0,
    grossProfit: 0,
    creditSales: 0,
    nonCreditSales: 0,
    totalCash: 0,
    totalMpesaBank: 0,
    profitMargin: 0,
    totalItemsSold: 0,
    costOfGoodsSold: 0,
    grossProfitMargin: 0,
    totalTransactions: 0,
    averageTransactionValue: 0,
    creditCollectionRate: 0,
    totalCreditGiven: 0,
    recognizedCreditRevenue: 0
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchDashboardData(newFilters);
  };

  const quickRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDashboardData();
      message.success('Quick refresh completed');
    } catch (error) {
      message.error('Quick refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: 'Confirm Logout',
      content: 'Are you sure you want to logout?',
      okText: 'Yes, Logout',
      cancelText: 'Cancel',
      onOk: () => {
        localStorage.removeItem('managerData');
        localStorage.removeItem('managerToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('userToken');
        localStorage.removeItem('authToken');
        localStorage.removeItem('sessionToken');
        navigate('/cashier-login');
        message.success('Logged out successfully');
      }
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
    return `KES ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${Number(value).toFixed(1)}%`;
  };

  // Legacy data for backward compatibility with tabs
  const totalRevenue = dashboardData.financialStats.totalRevenue || 0;
  const totalTransactions = dashboardData.financialStats.totalTransactions || 0;
  const totalExpenses = dashboardData.financialStats.totalExpenses || 0;
  const lowStockProducts = dashboardData.lowStockProducts || [];
  const outOfStockProducts = (dashboardData.lowStockProducts || []).filter(p => (p.currentStock || 0) === 0);

  // Stock alert columns
  const stockColumns = [
    { title: 'Product', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Stock', dataIndex: 'currentStock', key: 'stock', render: (stock) => <Badge count={stock || 0} showZero color={stock === 0 ? 'red' : stock <= (CONFIG.STOCK_ALERTS.LOW_STOCK_THRESHOLD || 5) ? 'orange' : 'green'} /> },
    { title: 'Min Stock', dataIndex: 'minStockLevel', key: 'minStock' },
    { title: 'Status', key: 'status', render: (_, record) => {
      const stock = record.currentStock || 0;
      if (stock === 0) return <Tag color="red">OUT OF STOCK</Tag>;
      if (stock <= (CONFIG.STOCK_ALERTS.LOW_STOCK_THRESHOLD || 5)) return <Tag color="orange">LOW STOCK</Tag>;
      return <Tag color="green">IN STOCK</Tag>;
    }},
  ];

  // Dead stock columns
  const deadStockColumns = [
    { title: 'Product', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Last Sold', dataIndex: 'lastSoldAt', key: 'lastSold', render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'Never' },
    { title: 'Days Unsold', key: 'daysUnsold', render: (_, record) => {
      const lastSold = record.lastSoldAt ? dayjs(record.lastSoldAt) : null;
      const days = lastSold ? dayjs().diff(lastSold, 'day') : dayjs().diff(record.createdAt, 'day');
      return <Text strong type={days > 7 ? 'danger' : 'warning'}>{days || 0} days</Text>;
    }},
    { title: 'Recommendation', key: 'recommendation', render: (_, record) => (
      <Tag color="purple">🚀 Advertise/Promote</Tag>
    )},
  ];

  // Expense columns
  const expenseColumns = [
    { title: 'Date', dataIndex: 'date', key: 'date', render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A' },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (category) => <Tag>{category || 'General'}</Tag> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (amount) => `KES ${(amount || 0).toLocaleString()}` },
    { title: 'Description', dataIndex: 'description', key: 'description' },
  ];

  // Transaction columns
  const transactionColumns = [
    { title: 'Date', dataIndex: 'saleDate', key: 'date', render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A' },
    { title: 'Customer', dataIndex: 'customerName', key: 'customer', render: (name) => name || 'Walk-in' },
    { title: 'Items', dataIndex: 'itemsCount', key: 'items' },
    { title: 'Amount', dataIndex: 'totalAmount', key: 'amount', render: (amount) => `KES ${(amount || 0).toLocaleString()}` },
    { title: 'Payment', dataIndex: 'paymentMethod', key: 'payment', render: (method) => <Tag color={method === 'cash' ? 'green' : 'blue'}>{method?.toUpperCase() || 'UNKNOWN'}</Tag> },
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0F172A' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#0F172A' }}>
      <Header style={{ 
        background: '#1E293B',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <Title level={4} style={{ color: 'white', margin: 0, fontWeight: 'bold' }}>
          PAMELA - MANAGER
        </Title>
        <Space>
          <Button 
            type={filters.autoRefresh ? "primary" : "default"}
            icon={<ReloadOutlined spin={filters.autoRefresh} />}
            onClick={() => handleFilterChange('autoRefresh', !filters.autoRefresh)}
            size="small"
            style={{ background: filters.autoRefresh ? '#52c41a' : undefined }}
          >
            Auto
          </Button>
          
          <Button 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={quickRefresh}
            disabled={refreshing}
            size="small"
          >
            Refresh
          </Button>
          
          <Button 
            icon={<FilterOutlined />}
            onClick={() => setFilterVisible(!filterVisible)}
            size="small"
          >
            Filters
          </Button>
          
          <Button 
            icon={<ExportOutlined />} 
            onClick={() => message.info('Export coming soon')}
            size="small"
          >
            Export
          </Button>
          
          <Button 
            icon={<LogoutOutlined />} 
            onClick={handleLogout} 
            danger
            size="small"
          >
            Logout
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px', background: '#0F172A' }}>
        {/* Filters Panel */}
        {filterVisible && (
          <Card 
            size="small" 
            style={{ 
              marginBottom: 16, 
              border: '1px solid #2D3748', 
              borderRadius: '8px',
              background: '#1A2332'
            }}
            title={
              <Space>
                <FilterOutlined style={{ color: '#6366F1' }} />
                <Text strong style={{ color: 'white' }}>Dashboard Filters</Text>
              </Space>
            }
            extra={
              <Button size="small" onClick={() => {
                setFilters({ dateRange: null, shop: 'all', autoRefresh: filters.autoRefresh });
                fetchDashboardData({ dateRange: null, shop: 'all', autoRefresh: filters.autoRefresh });
              }}>
                Clear Filters
              </Button>
            }
          >
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Date Range</Text>
                  <RangePicker
                    style={{ width: '100%' }}
                    value={filters.dateRange}
                    onChange={(dates) => handleFilterChange('dateRange', dates)}
                    format="YYYY-MM-DD"
                  />
                </Space>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Shop</Text>
                  <Select
                    style={{ width: '100%' }}
                    value={filters.shop}
                    onChange={(value) => handleFilterChange('shop', value)}
                    placeholder="Select Shop"
                  >
                    <Option value="all">All Shops</Option>
                    {shops.map(shop => (
                      <Option key={shop._id} value={shop._id}>
                        {shop.name}
                      </Option>
                    ))}
                  </Select>
                </Space>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Auto Refresh</Text>
                  <div>
                    <Switch
                      checked={filters.autoRefresh}
                      onChange={(checked) => handleFilterChange('autoRefresh', checked)}
                      checkedChildren="ON"
                      unCheckedChildren="OFF"
                    />
                    <Text style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8, fontSize: '12px' }}>
                      Refresh every 30s
                    </Text>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>
        )}

        {/* Data Timestamp */}
        <Row style={{ marginBottom: 16 }} justify="space-between" align="middle">
          <Col>
            {dataTimestamp && (
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                Last updated: {new Date(dataTimestamp).toLocaleString()}
                {filters.autoRefresh && (
                  <Tag color="green" style={{ marginLeft: 8 }}>Auto-refresh ON</Tag>
                )}
              </Text>
            )}
          </Col>
        </Row>

        {/* ENHANCED FINANCIAL OVERVIEW - Like AdminDashboard */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card 
              title={
                <Space>
                  <LineChartOutlined style={{ color: '#6366F1', fontSize: '18px' }} />
                  <Text strong style={{ fontSize: '16px', color: 'white' }}>Financial Overview</Text>
                  <Tag color="blue" style={{ marginLeft: 8 }}>COGS: {formatCurrency(dashboardData.financialStats.costOfGoodsSold)}</Tag>
                </Space>
              }
              style={{ 
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid #2D3748',
                background: '#1A2332'
              }}
              bodyStyle={{ padding: '16px' }}
            >
              {/* Row 1: Core Revenue Metrics */}
              <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
                <Col span={24}>
                  <Divider orientation="left" style={{ color: '#6366F1', fontSize: '12px', margin: '4px 0' }}>
                    <Text strong style={{ color: '#6366F1' }}>Revenue & Sales</Text>
                  </Divider>
                </Col>
                <FinancialStatCard 
                  title="Total Revenue" 
                  value={dashboardData.financialStats.totalRevenue || 0}
                  icon={<DollarOutlined />}
                  description="All sales including credit"
                />
                <FinancialStatCard 
                  title="Total Sales" 
                  value={dashboardData.financialStats.totalSales || 0}
                  icon={<ShoppingCartOutlined />}
                  type="number"
                  description="Number of transactions"
                />
                <FinancialStatCard 
                  title="Total Transactions" 
                  value={dashboardData.financialStats.totalTransactions || 0}
                  icon={<BarChartOutlined />}
                  type="number"
                  description="Sales count"
                />
                <FinancialStatCard 
                  title="Avg Transaction" 
                  value={dashboardData.financialStats.averageTransactionValue || 0}
                  icon={<CalculatorOutlined />}
                  description="Revenue per sale"
                />
              </Row>

              {/* Row 2: Cost & Profit Metrics */}
              <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
                <Col span={24}>
                  <Divider orientation="left" style={{ color: '#52c41a', fontSize: '12px', margin: '4px 0' }}>
                    <Text strong style={{ color: '#52c41a' }}>Cost & Profit</Text>
                  </Divider>
                </Col>
                <FinancialStatCard 
                  title="Cost of Goods Sold" 
                  value={dashboardData.financialStats.costOfGoodsSold || 0}
                  icon={<StockOutlined />}
                  color="#faad14"
                  description="Direct inventory cost"
                />
                <FinancialStatCard 
                  title="Gross Profit" 
                  value={dashboardData.financialStats.grossProfit || 0}
                  icon={<RiseOutlined />}
                  color="#52c41a"
                  type="profit"
                  description="Revenue - COGS"
                />
                <FinancialStatCard 
                  title="Total Expenses" 
                  value={dashboardData.financialStats.totalExpenses || 0}
                  icon={<WalletOutlined />}
                  color="#ff4d4f"
                  description="Operating costs"
                />
                <FinancialStatCard 
                  title="Net Profit" 
                  value={dashboardData.financialStats.netProfit || 0}
                  icon={<RiseOutlined />}
                  color={dashboardData.financialStats.netProfit >= 0 ? '#52c41a' : '#ff4d4f'}
                  type="profit"
                  description="After all expenses"
                />
              </Row>

              {/* Row 3: Profitability Ratios */}
              <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
                <Col span={24}>
                  <Divider orientation="left" style={{ color: '#13c2c2', fontSize: '12px', margin: '4px 0' }}>
                    <Text strong style={{ color: '#13c2c2' }}>Profitability Ratios</Text>
                  </Divider>
                </Col>
                <FinancialStatCard 
                  title="Profit Margin" 
                  value={dashboardData.financialStats.profitMargin || 0}
                  icon={<PercentageOutlined />}
                  type="percentage"
                  color="#13c2c2"
                  description="Net profit percentage"
                />
                <FinancialStatCard 
                  title="Gross Margin" 
                  value={dashboardData.financialStats.grossProfitMargin || 0}
                  icon={<PercentageOutlined />}
                  type="percentage"
                  color="#52c41a"
                  description="Gross profit percentage"
                />
                <FinancialStatCard 
                  title="Credit Collection" 
                  value={dashboardData.financialStats.creditCollectionRate || 0}
                  icon={<PercentageOutlined />}
                  type="percentage"
                  color="#faad14"
                  description="Credit recovery rate"
                />
                <FinancialStatCard 
                  title="Items Sold" 
                  value={dashboardData.financialStats.totalItemsSold || 0}
                  icon={<ProductOutlined />}
                  type="number"
                  color="#1890ff"
                  description="Total quantity sold"
                />
              </Row>

              {/* Row 4: Payment & Credit Breakdown */}
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Divider orientation="left" style={{ color: '#9b59b6', fontSize: '12px', margin: '4px 0' }}>
                    <Text strong style={{ color: '#9b59b6' }}>Payment & Credit Breakdown</Text>
                  </Divider>
                </Col>
                <FinancialStatCard 
                  title="Cash Collected" 
                  value={dashboardData.financialStats.totalCash || 0}
                  icon={<DollarOutlined />}
                  color="#52c41a"
                  description="Cash payments"
                />
                <FinancialStatCard 
                  title="Bank/M-Pesa" 
                  value={dashboardData.financialStats.totalMpesaBank || 0}
                  icon={<CreditCardOutlined />}
                  color="#1890ff"
                  description="Digital payments"
                />
                <FinancialStatCard 
                  title="Total Credit Given" 
                  value={dashboardData.financialStats.totalCreditGiven || 0}
                  icon={<CreditCardOutlined />}
                  color="#faad14"
                  description="Credit extended"
                />
                <FinancialStatCard 
                  title="Recognized Credit" 
                  value={dashboardData.financialStats.recognizedCreditRevenue || 0}
                  icon={<CheckCircleOutlined />}
                  color="#52c41a"
                  description="Credit collected"
                />
                <FinancialStatCard 
                  title="Outstanding Credit" 
                  value={dashboardData.financialStats.outstandingCredit || 0}
                  icon={<WarningOutlined />}
                  color="#ff4d4f"
                  description="Unpaid balance"
                />
                <FinancialStatCard 
                  title="Credit Sales" 
                  value={dashboardData.financialStats.creditSales || 0}
                  icon={<CreditCardOutlined />}
                  color="#faad14"
                  description="Credit transactions"
                />
              </Row>

              {/* Summary Bar */}
              <div style={{ 
                marginTop: 16, 
                padding: '12px 16px', 
                background: 'rgba(99, 102, 241, 0.1)', 
                borderRadius: '6px',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}>
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} sm={12}>
                    <Space>
                      <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Summary:</Text>
                      <Tag color="green">Revenue: {formatCurrency(dashboardData.financialStats.totalRevenue)}</Tag>
                      <Tag color="orange">COGS: {formatCurrency(dashboardData.financialStats.costOfGoodsSold)}</Tag>
                      <Tag color="blue">Gross Profit: {formatCurrency(dashboardData.financialStats.grossProfit)}</Tag>
                      <Tag color={dashboardData.financialStats.netProfit >= 0 ? 'green' : 'red'}>
                        Net Profit: {formatCurrency(dashboardData.financialStats.netProfit)}
                      </Tag>
                    </Space>
                  </Col>
                  <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                    <Space>
                      <Tag color="purple">Margin: {formatPercentage(dashboardData.financialStats.profitMargin)}</Tag>
                      <Tag color="cyan">Gross Margin: {formatPercentage(dashboardData.financialStats.grossProfitMargin)}</Tag>
                      {dashboardData.financialStats.outstandingCredit > 0 && (
                        <Tag color="red">⚠️ Outstanding: {formatCurrency(dashboardData.financialStats.outstandingCredit)}</Tag>
                      )}
                    </Space>
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Alerts Section */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            {dashboardData.businessStats.lowStockCount > 0 && (
              <Alert
                message={`${dashboardData.businessStats.lowStockCount} products are low on stock`}
                description="Some products need to be reordered to avoid stockouts."
                type="warning"
                showIcon
                action={
                  <Button size="small" type="primary" onClick={() => navigate('/manager/inventory')}>
                    View Inventory
                  </Button>
                }
                style={{ marginBottom: 8, borderRadius: '8px' }}
              />
            )}
            {dashboardData.financialStats.outstandingCredit > 0 && (
              <Alert
                message={`Outstanding credit: ${formatCurrency(dashboardData.financialStats.outstandingCredit)}`}
                description="Monitor credit collection and follow up with customers."
                type="info"
                showIcon
                action={
                  <Button size="small" type="primary" onClick={() => navigate('/manager/credits')}>
                    View Credits
                  </Button>
                }
                style={{ marginBottom: 8, borderRadius: '8px' }}
              />
            )}
          </Col>
        </Row>

        {/* Main Content Grid - Recent Transactions and Low Stock */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <ShoppingCartOutlined style={{ color: '#6366F1' }} />
                  <Text strong style={{ color: 'white' }}>Recent Transactions</Text>
                  <Badge count={dashboardData.recentTransactions.length} showZero />
                </Space>
              }
              extra={
                <Space>
                  <Search
                    placeholder="Search..."
                    size="small"
                    style={{ width: 120 }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                  />
                  <Button 
                    size="small" 
                    type="primary" 
                    onClick={() => navigate('/manager/transactions')}
                  >
                    View All
                  </Button>
                </Space>
              }
              style={{ 
                borderRadius: '12px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid #2D3748',
                background: '#1A2332'
              }}
            >
              <Table 
                dataSource={dashboardData.recentTransactions} 
                columns={transactionColumns} 
                pagination={{ pageSize: 5, size: 'small' }}
                size="small"
                rowKey={(record) => record._id || record.id || `txn-${Math.random()}`}
                locale={{ emptyText: 'No recent transactions' }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <Text strong style={{ color: 'white' }}>Low Stock Products</Text>
                  <Badge 
                    count={dashboardData.lowStockProducts.length} 
                    showZero 
                    style={{ backgroundColor: '#ff4d4f' }} 
                  />
                </Space>
              }
              extra={
                <Button 
                  size="small" 
                  onClick={() => navigate('/manager/inventory')}
                >
                  Manage
                </Button>
              }
              style={{ 
                borderRadius: '12px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid #2D3748',
                background: '#1A2332'
              }}
            >
              <Table 
                dataSource={dashboardData.lowStockProducts} 
                columns={stockColumns} 
                pagination={false}
                size="small"
                rowKey={(record) => record._id || record.id || `prod-${Math.random()}`}
                locale={{ emptyText: 'All products well stocked' }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <ProductOutlined style={{ color: '#52c41a' }} />
                  <Text strong style={{ color: 'white' }}>Top Selling Products</Text>
                </Space>
              }
              extra={
                <Button 
                  size="small" 
                  type="primary" 
                  onClick={() => navigate('/manager/products')}
                >
                  View All
                </Button>
              }
              style={{ 
                borderRadius: '12px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid #2D3748',
                background: '#1A2332'
              }}
            >
              <List
                dataSource={dashboardData.topProducts}
                renderItem={(item, index) => (
                  <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #2D3748' }}>
                    <List.Item.Meta
                      avatar={
                        <Avatar 
                          size="small" 
                          style={{ 
                            backgroundColor: index < 3 ? '#6366F1' : '#4A5568',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: 'white'
                          }}
                        >
                          {index + 1}
                        </Avatar>
                      }
                      title={
                        <Text style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
                          {item.name || 'Unknown Product'}
                        </Text>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                            Sold: {item.totalSold || 0} units
                          </Text>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                            Revenue: {formatCurrency(item.totalRevenue || 0)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: 'No product sales data' }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <ShopOutlined style={{ color: '#9b59b6' }} />
                  <Text strong style={{ color: 'white' }}>Shop Performance</Text>
                </Space>
              }
              extra={
                <Button 
                  size="small" 
                  type="primary" 
                  onClick={() => navigate('/manager/shops')}
                >
                  View All
                </Button>
              }
              style={{ 
                borderRadius: '12px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid #2D3748',
                background: '#1A2332'
              }}
            >
              <List
                dataSource={dashboardData.shopPerformance}
                renderItem={(item) => (
                  <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #2D3748' }}>
                    <List.Item.Meta
                      avatar={
                        <Avatar 
                          size="small" 
                          style={{ 
                            backgroundColor: '#9b59b6',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: 'white'
                          }}
                        >
                          {item.name?.charAt(0)?.toUpperCase() || 'S'}
                        </Avatar>
                      }
                      title={
                        <Text style={{ fontSize: '13px', fontWeight: 'bold', color: 'white' }}>
                          {item.name || 'Unknown Shop'}
                        </Text>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                            Transactions: {item.transactions || 0}
                          </Text>
                          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                            Revenue: {formatCurrency(item.revenue || 0)}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: 'No shop performance data' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Tabs for additional views (Stock Alerts, Dead Stock, Expenses) */}
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          style={{ marginTop: 24 }}
          tabBarStyle={{ borderBottom: '1px solid #2D3748' }}
        >
          {/* Dead Stock Tab */}
          <TabPane 
            tab={<span style={{ color: 'white' }}><InfoCircleOutlined /> Dead Stock <Badge count={dashboardData.lowStockProducts.filter(p => {
              const lastSold = p.lastSoldAt ? dayjs(p.lastSoldAt) : null;
              return !lastSold || lastSold.isBefore(dayjs().subtract(30, 'days'));
            }).length} /></span>} 
            key="deadStock"
          >
            <Card 
              title="Dead Stock Recommendations"
              style={{ 
                borderRadius: '12px',
                border: '1px solid #2D3748',
                background: '#1A2332'
              }}
            >
              <Alert 
                message={`Products not sold in ${CONFIG.STOCK_ALERTS.DEAD_STOCK_DAYS || 30} days should be promoted or advertised.`} 
                type="info" 
                showIcon 
                style={{ marginBottom: 16 }} 
              />
              {dashboardData.lowStockProducts.filter(p => {
                const lastSold = p.lastSoldAt ? dayjs(p.lastSoldAt) : null;
                return !lastSold || lastSold.isBefore(dayjs().subtract(30, 'days'));
              }).length > 0 ? (
                <Table 
                  columns={deadStockColumns} 
                  dataSource={dashboardData.lowStockProducts.filter(p => {
                    const lastSold = p.lastSoldAt ? dayjs(p.lastSoldAt) : null;
                    return !lastSold || lastSold.isBefore(dayjs().subtract(30, 'days'));
                  })} 
                  rowKey="_id" 
                  pagination={false}
                />
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.7)' }}>No dead stock detected - all products are selling well!</Text>
              )}
            </Card>
          </TabPane>

          {/* Expenses Tab */}
          <TabPane 
            tab={<span style={{ color: 'white' }}><DollarOutlined /> Expenses</span>} 
            key="expenses"
          >
            <Card 
              title="Expenses"
              extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/manager/expenses')}>
                  Manage Expenses
                </Button>
              }
              style={{ 
                borderRadius: '12px',
                border: '1px solid #2D3748',
                background: '#1A2332'
              }}
            >
              {dashboardData.expenses?.length > 0 ? (
                <Table 
                  columns={expenseColumns} 
                  dataSource={dashboardData.expenses || []} 
                  rowKey="_id" 
                  pagination={{ pageSize: 10 }}
                />
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.7)' }}>No expenses recorded.</Text>
              )}
            </Card>
          </TabPane>
        </Tabs>
      </Content>
    </Layout>
  );
};

export default ManagerDashboard;