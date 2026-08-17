// src/pages/Admin/AdminDashboard.jsx - UPDATED WITH SECURITY FEATURES
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Menu, Typography, Card, Row, Col, Table, Tag, Statistic, List, Alert, Spin, 
  Button, Modal, Space, Tooltip, Divider, message, Badge, Avatar, Progress,
  Tabs, Descriptions, Dropdown, Input, Select, DatePicker, Switch
} from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  DollarOutlined,
  ShopOutlined,
  ProductOutlined,
  WarningOutlined,
  BarChartOutlined,
  MoneyCollectOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExportOutlined,
  ShoppingCartOutlined,
  RiseOutlined,
  FallOutlined,
  CalculatorOutlined,
  LineChartOutlined,
  PieChartOutlined,
  LogoutOutlined,
  SettingOutlined,
  CreditCardOutlined,
  SearchOutlined,
  TeamOutlined,
  FilterOutlined,
  BankOutlined,
  CreditCardFilled,
  WalletOutlined,
  SecurityOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSecurity } from '../../contexts/SecurityContext';
import { 
  unifiedAPI, 
  shopAPI, 
  authAPI 
} from '../../services/api';
import './AdminDashboard.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Enhanced Admin Dashboard Component with Security Integration
const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, timeRemaining, isSessionExpiring, refreshSession } = useSecurity();
  const [collapsed, setCollapsed] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
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
    shopPerformance: [],
    creditAlerts: [],
    cashierPerformance: [],
    pendingVerifications: []
  });
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewModalContent, setViewModalContent] = useState(null);
  const [viewModalTitle, setViewModalTitle] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataTimestamp, setDataTimestamp] = useState(null);
  const [shops, setShops] = useState([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: null,
    shop: 'all',
    autoRefresh: false
  });

  // User menu items with security features
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile Settings'
    },
    {
      key: 'devices',
      icon: <SecurityOutlined />,
      label: 'Manage Devices',
      onClick: () => navigate('/admin/verify-device')
    },
    {
      key: 'sessions',
      icon: <HistoryOutlined />,
      label: 'Active Sessions'
    },
    {
      type: 'divider'
    },
    {
      key: 'refresh',
      icon: <ReloadOutlined />,
      label: 'Refresh Session',
      onClick: async () => {
        try {
          await refreshSession();
          message.success('Session refreshed successfully');
        } catch (error) {
          message.error('Failed to refresh session');
        }
      }
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: `Logout${timeRemaining ? ` (${timeRemaining}s)` : ''}`,
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: 'Confirm Logout',
          content: 'Are you sure you want to logout?',
          okText: 'Yes, Logout',
          cancelText: 'Cancel',
          onOk: () => {
            logout('manual');
            navigate('/cashier-login');
            message.success('Logged out successfully');
          }
        });
      }
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 3000);
    
    fetchDashboardData();
    fetchPendingVerifications();
    
    return () => clearTimeout(timer);
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    let intervalId;
    
    if (filters.autoRefresh) {
      intervalId = setInterval(() => {
        console.log('🔄 Auto-refreshing dashboard data...');
        fetchDashboardData();
        fetchPendingVerifications();
      }, 30000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [filters.autoRefresh]);

  // Fetch pending verifications for admin
  const fetchPendingVerifications = async () => {
    try {
      const response = await authAPI.getVerificationRequests();
      if (response.success) {
        setDashboardData(prev => ({
          ...prev,
          pendingVerifications: response.data || []
        }));
      }
    } catch (error) {
      console.error('Error fetching pending verifications:', error);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async (customFilters = null) => {
    const activeFilters = customFilters || filters;
    
    console.log('🚀 Fetching dashboard data...', activeFilters);
    
    try {
      setLoading(true);
      setRefreshing(true);
      
      // Fetch shops
      const shopsData = await shopAPI.getAll();
      setShops(shopsData);

      // Build params
      const params = {};
      if (activeFilters.dateRange && activeFilters.dateRange[0] && activeFilters.dateRange[1]) {
        params.startDate = activeFilters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = activeFilters.dateRange[1].format('YYYY-MM-DD');
      }
      if (activeFilters.shop && activeFilters.shop !== 'all') {
        params.shopId = activeFilters.shop;
      }

      // Fetch combined data
      const comprehensiveData = await unifiedAPI.getCombinedTransactions(params);
      
      const processedData = processDashboardData(comprehensiveData, shopsData, activeFilters);

      setDashboardData(prev => ({
        ...processedData,
        pendingVerifications: prev.pendingVerifications || []
      }));
      setDataTimestamp(new Date().toISOString());
      
      console.log('✅ Dashboard data processed');
      
    } catch (error) {
      console.error('💥 Dashboard fetch failed:', error);
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Process dashboard data
  const processDashboardData = (comprehensiveData, shops, activeFilters) => {
    const transactions = comprehensiveData.salesWithProfit || [];
    const financialStats = comprehensiveData.financialStats || getDefaultStats();
    const products = comprehensiveData.products || [];
    const expenses = comprehensiveData.expenses || [];
    const credits = comprehensiveData.credits || [];
    const cashiers = comprehensiveData.cashiers || [];

    // Recent transactions
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.saleDate || b.createdAt) - new Date(a.saleDate || a.createdAt))
      .slice(0, 10);

    // Low stock products
    const lowStockProducts = products.filter(p => 
      (p.currentStock || 0) <= (p.minStockLevel || 5)
    ).slice(0, 5);

    // Top products
    const topProducts = calculateTopProducts(transactions, 5);

    // Shop performance
    const shopPerformance = calculateShopPerformance(transactions, shops);

    // Cashier performance
    const cashierPerformance = calculateCashierPerformance(transactions, cashiers);

    // Credit alerts
    const creditAlerts = credits
      .filter(credit => {
        const isOverdue = credit.dueDate && new Date(credit.dueDate) < new Date() && 
                         (credit.balanceDue || 0) > 0;
        if (activeFilters.shop && activeFilters.shop !== 'all') {
          const creditShopId = credit.shopId || (credit.shop && typeof credit.shop === 'object' ? credit.shop._id : credit.shop);
          return isOverdue && creditShopId === activeFilters.shop;
        }
        return isOverdue;
      })
      .slice(0, 5);

    return {
      financialStats,
      businessStats: {
        totalProducts: products.length,
        totalShops: shops.length,
        totalCashiers: cashiers.length,
        lowStockCount: lowStockProducts.length,
        activeCredits: credits.filter(c => c.status !== 'paid' && (c.balanceDue || 0) > 0).length
      },
      recentTransactions,
      lowStockProducts,
      topProducts,
      shopPerformance,
      cashierPerformance,
      creditAlerts
    };
  };

  // Helper: Calculate top products
  const calculateTopProducts = (transactions, limit = 5) => {
    const productMap = {};
    transactions.forEach(transaction => {
      transaction.items?.forEach(item => {
        const productId = item.productId?.toString() || item.productName;
        const productName = item.productName || 'Unknown Product';
        if (!productMap[productId]) {
          productMap[productId] = {
            id: productId,
            name: productName,
            totalSold: 0,
            totalRevenue: 0,
            totalProfit: 0
          };
        }
        const quantity = item.quantity || 1;
        const revenue = item.totalPrice || (item.price * quantity);
        const cost = (item.buyingPrice || 0) * quantity;
        productMap[productId].totalSold += quantity;
        productMap[productId].totalRevenue += revenue;
        productMap[productId].totalProfit += (revenue - cost);
      });
    });
    return Object.values(productMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  };

  // Helper: Calculate shop performance
  const calculateShopPerformance = (transactions, shops) => {
    const shopMap = {};
    transactions.forEach(transaction => {
      const shopId = transaction.shop || transaction.shopId;
      if (!shopId) return;
      if (!shopMap[shopId]) {
        const shop = shops.find(s => s._id?.toString() === shopId?.toString()) ||
                    { name: 'Unknown Shop' };
        shopMap[shopId] = {
          id: shopId,
          name: shop.name || 'Unknown Shop',
          revenue: 0,
          transactions: 0,
          profit: 0
        };
      }
      shopMap[shopId].revenue += transaction.totalAmount || 0;
      shopMap[shopId].transactions += 1;
      shopMap[shopId].profit += transaction.profit || 0;
    });
    return Object.values(shopMap)
      .sort((a, b) => b.revenue - a.revenue);
  };

  // Helper: Calculate cashier performance
  const calculateCashierPerformance = (transactions, cashiers) => {
    const cashierMap = {};
    transactions.forEach(transaction => {
      const cashierId = transaction.cashierId || transaction.cashierId?._id;
      if (!cashierId) return;
      if (!cashierMap[cashierId]) {
        const cashier = cashiers.find(c => c._id?.toString() === cashierId?.toString()) ||
                       { name: transaction.cashierName || 'Unknown Cashier' };
        cashierMap[cashierId] = {
          id: cashierId,
          name: cashier.name || 'Unknown Cashier',
          revenue: 0,
          transactions: 0,
          profit: 0
        };
      }
      cashierMap[cashierId].revenue += transaction.totalAmount || 0;
      cashierMap[cashierId].transactions += 1;
      cashierMap[cashierId].profit += transaction.profit || 0;
    });
    return Object.values(cashierMap)
      .sort((a, b) => b.revenue - a.revenue);
  };

  // Default stats
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
    profitMargin: 0
  });

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchDashboardData(newFilters);
  };

  // Handle refresh
  const handleRefreshData = () => {
    fetchDashboardData();
    fetchPendingVerifications();
  };

  // Handle quick refresh
  const quickRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDashboardData();
      await fetchPendingVerifications();
      message.success('Quick refresh completed');
    } catch (error) {
      console.error('Quick refresh failed:', error);
      message.error('Quick refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    Modal.confirm({
      title: 'Confirm Logout',
      content: 'Are you sure you want to logout?',
      okText: 'Yes, Logout',
      cancelText: 'Cancel',
      onOk: () => {
        logout('manual');
        navigate('/cashier-login');
        message.success('Logged out successfully');
      }
    });
  };

  // Handle view all
  const handleViewAll = (type) => {
    switch (type) {
      case 'sales':
        navigate('/admin/transactions');
        break;
      case 'cashiers':
        navigate('/admin/cashiers');
        break;
      case 'shops':
        navigate('/admin/shops');
        break;
      case 'products':
        navigate('/admin/products');
        break;
      case 'expenses':
        navigate('/admin/expenses');
        break;
      case 'credits':
        navigate('/admin/credits');
        break;
      case 'inventory':
        navigate('/admin/inventory');
        break;
      case 'verifications':
        navigate('/admin/verify-device');
        break;
      default:
        break;
    }
  };

  // Get active tab
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/admin/dashboard')) return 'dashboard';
    if (path.includes('/admin/cashiers')) return 'cashiers';
    if (path.includes('/admin/shops')) return 'shops';
    if (path.includes('/admin/products')) return 'products';
    if (path.includes('/admin/inventory')) return 'inventory';
    if (path.includes('/admin/expenses')) return 'expenses';
    if (path.includes('/admin/transactions')) return 'transactions';
    if (path.includes('/admin/credits')) return 'credits';
    if (path.includes('/admin/verify-device')) return 'verify-device';
    return 'dashboard';
  };

  // Handle menu click
  const handleMenuClick = ({ key }) => {
    switch (key) {
      case 'dashboard':
        navigate('/admin/dashboard');
        break;
      case 'cashiers':
        navigate('/admin/cashiers');
        break;
      case 'shops':
        navigate('/admin/shops');
        break;
      case 'products':
        navigate('/admin/products');
        break;
      case 'inventory':
        navigate('/admin/inventory');
        break;
      case 'expenses':
        navigate('/admin/expenses');
        break;
      case 'transactions':
        navigate('/admin/transactions');
        break;
      case 'credits':
        navigate('/admin/credits');
        break;
      case 'verify-device':
        navigate('/admin/verify-device');
        break;
      default:
        navigate('/admin/dashboard');
    }
  };

  // Sales columns
  const salesColumns = [
    {
      title: 'Transaction ID',
      dataIndex: '_id',
      key: 'transactionId',
      render: (id, record) => (
        <Tooltip title={id}>
          <Text code style={{ fontSize: '11px' }}>
            {record.transactionNumber || (id ? `${id.substring(0, 8)}...` : 'N/A')}
          </Text>
        </Tooltip>
      ),
      width: 100
    },
    {
      title: 'Date',
      dataIndex: 'saleDate',
      key: 'saleDate',
      render: (date) => date ? new Date(date).toLocaleDateString('en-KE') : 'N/A',
      width: 90
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (name) => <Text style={{ fontSize: '12px' }}>{name || 'Walk-in'}</Text>,
      width: 100
    },
    {
      title: 'Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: '12px', color: '#1890ff' }}>
            {formatCurrency(amount)}
          </Text>
          <Tag 
            color={record.isCreditTransaction ? 'orange' : 'green'}
            style={{ fontSize: '9px', margin: 0 }}
          >
            {record.isCreditTransaction ? 'CREDIT' : 'COMPLETE'}
          </Tag>
        </Space>
      ),
      width: 100
    },
    {
      title: 'Revenue',
      key: 'recognizedRevenue',
      render: (_, record) => (
        <Text strong style={{ fontSize: '12px', color: '#52c41a' }}>
          {formatCurrency(record.recognizedRevenue || record.totalAmount)}
        </Text>
      ),
      width: 100
    },
    {
      title: 'Profit',
      dataIndex: 'profit',
      key: 'profit',
      render: (profit) => (
        <Text 
          strong 
          style={{ 
            fontSize: '12px', 
            color: profit >= 0 ? '#52c41a' : '#ff4d4f'
          }}
        >
          {formatCurrency(profit)}
        </Text>
      ),
      width: 80
    },
    {
      title: 'Shop',
      dataIndex: 'shop',
      key: 'shop',
      render: (text) => <Tag color="blue" style={{ fontSize: '10px' }}>{text || 'Unknown Shop'}</Tag>,
      width: 80
    }
  ];

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'KES 0';
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Low stock columns
  const lowStockColumns = [
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <ProductOutlined />
          <Text strong={record.currentStock === 0} style={{ fontSize: '12px' }}>{text}</Text>
          {record.currentStock === 0 && <Tag color="red" style={{ fontSize: '10px' }}>OUT</Tag>}
        </Space>
      )
    },
    {
      title: 'Stock',
      dataIndex: 'currentStock',
      key: 'currentStock',
      render: (stock, record) => (
        <Badge 
          count={stock} 
          showZero 
          style={{ 
            backgroundColor: record.currentStock === 0 ? '#cf1322' : '#faad14',
            fontSize: '10px'
          }}
        />
      ),
      width: 60
    },
    {
      title: 'Min',
      dataIndex: 'minStockLevel',
      key: 'minStockLevel',
      render: (min) => <Text style={{ fontSize: '12px' }}>{min || 5}</Text>,
      width: 50
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#0F172A' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth="80"
        style={{ 
          background: '#1E293B',
          boxShadow: '2px 0 8px rgba(0,0,0,0.3)'
        }}
      >
        <div className="logo" style={{ 
          padding: '16px 0', 
          textAlign: 'center', 
          borderBottom: '1px solid rgba(255,255,255,0.1)' 
        }}>
          <Title level={4} style={{ color: 'white', margin: 0, fontWeight: 'bold' }}>
            {collapsed ? 'TP' : 'PAMELA'}
          </Title>
        </div>
        <Menu 
          theme="dark" 
          selectedKeys={[getActiveTab()]}
          mode="inline"
          onClick={handleMenuClick}
          style={{ background: 'transparent', border: 'none' }}
        >
          <Menu.Item key="dashboard" icon={<DashboardOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Dashboard
          </Menu.Item>
          <Menu.Item key="products" icon={<ProductOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Products
          </Menu.Item>
          <Menu.Item key="shops" icon={<ShopOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Shops
          </Menu.Item>
          <Menu.Item key="cashiers" icon={<UserOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Cashiers
          </Menu.Item>
          <Menu.Item key="transactions" icon={<BarChartOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Transactions
          </Menu.Item>
          <Menu.Item key="expenses" icon={<DollarOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Expenses
          </Menu.Item>
          <Menu.Item key="inventory" icon={<AppstoreOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Inventory
          </Menu.Item>
          <Menu.Item key="credits" icon={<CreditCardOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Credits
          </Menu.Item>
          <Menu.Item key="verify-device" icon={<SecurityOutlined />} style={{ margin: '4px 8px', borderRadius: '6px' }}>
            Device Verify
            {dashboardData.pendingVerifications?.length > 0 && (
              <Badge 
                count={dashboardData.pendingVerifications.length} 
                style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }}
              />
            )}
          </Menu.Item>
        </Menu>
      </Sider>

      <Layout className="site-layout">
        <Header className="site-layout-header" style={{ 
          background: '#1E293B',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64
        }}>
          <Title level={4} style={{ color: 'white', margin: 0, fontWeight: 'bold' }}>
            PAMELA - ADMIN DASHBOARD
          </Title>
          <Space>
            {/* Session Timer */}
            {timeRemaining !== undefined && (
              <Tooltip title={`Session expires in ${timeRemaining}s`}>
                <Tag 
                  color={timeRemaining <= 10 ? 'red' : timeRemaining <= 30 ? 'orange' : 'green'}
                  style={{ margin: 0 }}
                >
                  <HistoryOutlined /> {timeRemaining}s
                </Tag>
              </Tooltip>
            )}
            
            {/* Auto-refresh toggle */}
            <Tooltip title={filters.autoRefresh ? "Auto-refresh ON (30s)" : "Auto-refresh OFF"}>
              <Button 
                type={filters.autoRefresh ? "primary" : "default"}
                icon={<ReloadOutlined spin={filters.autoRefresh} />}
                onClick={() => handleFilterChange('autoRefresh', !filters.autoRefresh)}
                size="small"
                style={{ background: filters.autoRefresh ? '#52c41a' : '#f0f0f0' }}
              >
                Auto
              </Button>
            </Tooltip>
            
            <Button 
              icon={<ReloadOutlined spin={refreshing} />} 
              onClick={quickRefresh}
              disabled={refreshing}
              size="small"
              type="primary"
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
              onClick={() => {
                // Export functionality
                message.info('Export functionality coming soon');
              }}
              loading={exportLoading}
              size="small"
            >
              Export
            </Button>
            
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <Button type="text" style={{ color: 'white' }} size="small">
                <Space>
                  <UserOutlined />
                  {user?.name || 'Admin'}
                </Space>
              </Button>
            </Dropdown>
            
            <Button 
              type="primary" 
              danger 
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              size="small"
            >
              Logout
            </Button>
          </Space>
        </Header>
        
        <Content style={{ margin: '16px', padding: 16, background: '#0F172A', minHeight: 'calc(100vh - 112px)' }}>
          {location.pathname === '/admin/dashboard' && (
            <>
              {/* Filter Panel */}
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

              {loading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)' }}>Loading dashboard data...</div>
                </div>
              ) : (
                <>
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
                    <Col>
                      {/* Pending Verifications Badge */}
                      {dashboardData.pendingVerifications?.length > 0 && (
                        <Button 
                          type="primary" 
                          danger
                          icon={<SecurityOutlined />}
                          onClick={() => navigate('/admin/verify-device')}
                          size="small"
                        >
                          {dashboardData.pendingVerifications.length} Pending Verifications
                        </Button>
                      )}
                    </Col>
                  </Row>

                  {/* Financial Overview */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col span={24}>
                      <Card 
                        title={
                          <Space>
                            <LineChartOutlined style={{ color: '#6366F1', fontSize: '18px' }} />
                            <Text strong style={{ fontSize: '16px', color: 'white' }}>Financial Overview</Text>
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
                        <Row gutter={[16, 16]}>
                          <Col xs={24} sm={12} md={8} lg={6}>
                            <Card 
                              size="small" 
                              style={{ 
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                border: 'none',
                                borderRadius: '8px'
                              }}
                              bodyStyle={{ padding: '12px', textAlign: 'center' }}
                            >
                              <Statistic 
                                title={<Text style={{ color: 'white', fontSize: '12px' }}>Total Revenue</Text>}
                                value={dashboardData.financialStats.totalRevenue} 
                                prefix="KES" 
                                precision={0}
                                valueStyle={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}
                              />
                            </Card>
                          </Col>
                          
                          <Col xs={24} sm={12} md={8} lg={6}>
                            <Card 
                              size="small" 
                              style={{ 
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                border: 'none',
                                borderRadius: '8px'
                              }}
                              bodyStyle={{ padding: '12px', textAlign: 'center' }}
                            >
                              <Statistic 
                                title={<Text style={{ color: 'white', fontSize: '12px' }}>Total Sales</Text>}
                                value={dashboardData.financialStats.totalSales} 
                                precision={0}
                                valueStyle={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}
                              />
                            </Card>
                          </Col>

                          <Col xs={24} sm={12} md={8} lg={6}>
                            <Card 
                              size="small" 
                              style={{ 
                                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                border: 'none',
                                borderRadius: '8px'
                              }}
                              bodyStyle={{ padding: '12px', textAlign: 'center' }}
                            >
                              <Statistic 
                                title={<Text style={{ color: 'white', fontSize: '12px' }}>Net Profit</Text>}
                                value={dashboardData.financialStats.netProfit} 
                                prefix="KES" 
                                precision={0}
                                valueStyle={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}
                              />
                            </Card>
                          </Col>

                          <Col xs={24} sm={12} md={8} lg={6}>
                            <Card 
                              size="small" 
                              style={{ 
                                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                                border: 'none',
                                borderRadius: '8px'
                              }}
                              bodyStyle={{ padding: '12px', textAlign: 'center' }}
                            >
                              <Statistic 
                                title={<Text style={{ color: 'white', fontSize: '12px' }}>Outstanding Credit</Text>}
                                value={dashboardData.financialStats.outstandingCredit} 
                                prefix="KES" 
                                precision={0}
                                valueStyle={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}
                              />
                            </Card>
                          </Col>
                        </Row>
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
                            <Button size="small" type="primary" onClick={() => handleViewAll('inventory')}>
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
                            <Button size="small" type="primary" onClick={() => handleViewAll('credits')}>
                              View Credits
                            </Button>
                          }
                          style={{ marginBottom: 8, borderRadius: '8px' }}
                        />
                      )}
                      {dashboardData.pendingVerifications?.length > 0 && (
                        <Alert
                          message={`${dashboardData.pendingVerifications.length} device(s) pending verification`}
                          description="New devices are waiting for your approval."
                          type="error"
                          showIcon
                          icon={<SecurityOutlined />}
                          action={
                            <Button size="small" type="primary" onClick={() => handleViewAll('verifications')}>
                              Review
                            </Button>
                          }
                          style={{ borderRadius: '8px' }}
                        />
                      )}
                    </Col>
                  </Row>

                  {/* Main Content Grid */}
                  <Row gutter={[16, 16]}>
                    {/* Recent Transactions */}
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
                              placeholder="Search transactions..."
                              size="small"
                              style={{ width: 150 }}
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              allowClear
                            />
                            <Button 
                              size="small" 
                              type="primary" 
                              onClick={() => handleViewAll('sales')}
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
                          columns={salesColumns} 
                          pagination={{ 
                            pageSize: 5,
                            size: 'small',
                            simple: true
                          }}
                          size="small"
                          scroll={{ x: 600 }}
                          rowKey="_id"
                          locale={{ emptyText: 'No recent transactions' }}
                        />
                      </Card>
                    </Col>

                    {/* Low Stock Products */}
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
                            onClick={() => handleViewAll('inventory')}
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
                          columns={lowStockColumns} 
                          pagination={false}
                          size="small"
                          rowKey="_id"
                          locale={{ emptyText: 'All products are well stocked' }}
                        />
                      </Card>
                    </Col>

                    {/* Top Products */}
                    <Col xs={24} lg={12}>
                      <Card 
                        title={
                          <Space>
                            <ProductOutlined style={{ color: '#52c41a' }} />
                            <Text strong style={{ color: 'white' }}>Top Selling Products</Text>
                          </Space>
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
                                    {item.name}
                                  </Text>
                                }
                                description={
                                  <Space direction="vertical" size={0}>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                                      Sold: {item.totalSold} units
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                                      Revenue: {formatCurrency(item.totalRevenue)}
                                    </Text>
                                    <Text strong style={{ 
                                      fontSize: '11px', 
                                      color: item.totalProfit >= 0 ? '#52c41a' : '#ff4d4f'
                                    }}>
                                      Profit: {formatCurrency(item.totalProfit)}
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

                    {/* Shop Performance */}
                    <Col xs={24} lg={12}>
                      <Card 
                        title={
                          <Space>
                            <ShopOutlined style={{ color: '#9b59b6' }} />
                            <Text strong style={{ color: 'white' }}>Shop Performance</Text>
                          </Space>
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
                          renderItem={(item, index) => (
                            <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #2D3748' }}>
                              <List.Item.Meta
                                avatar={
                                  <Avatar 
                                    size="small" 
                                    style={{ 
                                      backgroundColor: index < 3 ? '#9b59b6' : '#4A5568',
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
                                    {item.name}
                                  </Text>
                                }
                                description={
                                  <Space direction="vertical" size={0}>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                                      Transactions: {item.transactions}
                                    </Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
                                      Revenue: {formatCurrency(item.revenue)}
                                    </Text>
                                    <Text strong style={{ 
                                      fontSize: '11px', 
                                      color: item.profit >= 0 ? '#52c41a' : '#ff4d4f'
                                    }}>
                                      Profit: {formatCurrency(item.profit)}
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
                </>
              )}
            </>
          )}
          
          {location.pathname !== '/admin/dashboard' && <Outlet />}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;