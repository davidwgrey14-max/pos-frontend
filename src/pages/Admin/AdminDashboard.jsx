// src/pages/Admin/AdminDashboard.jsx - Connected to Backend API
import React, { useState, useEffect } from 'react';
import { 
  Layout, Menu, Typography, Card, Row, Col, Table, Tag, Statistic, List, Alert, Spin, 
  Button, Modal, Space, Tooltip, message, Badge, Avatar,
  Dropdown, Input, Select, DatePicker, Switch, Divider
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
  ReloadOutlined,
  ExportOutlined,
  ShoppingCartOutlined,
  LineChartOutlined,
  LogoutOutlined,
  CreditCardOutlined,
  SearchOutlined,
  FilterOutlined,
  SafetyOutlined,
  TeamOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../../contexts/SecurityContext';
import { unifiedAPI, shopAPI, authAPI } from '../../services/api';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout, timeRemaining, refreshSession } = useSecurity();
  const [collapsed, setCollapsed] = useState(false);
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
      totalItemsSold: 0
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
    shopPerformance: [],
    pendingVerifications: []
  });

  // User menu items
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile Settings'
    },
    {
      key: 'devices',
      icon: <SafetyOutlined />,
      label: 'Manage Devices'
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
            navigate('/admin-login');
            message.success('Logged out successfully');
          }
        });
      }
    }
  ];

  useEffect(() => {
    fetchDashboardData();
    fetchPendingVerifications();
    // Start auto-refresh if enabled
    const intervalId = setInterval(() => {
      if (filters.autoRefresh) {
        console.log('🔄 Auto-refreshing dashboard data...');
        fetchDashboardData();
        fetchPendingVerifications();
      }
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Auto-refresh effect - re-run when autoRefresh toggle changes
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
      if (intervalId) clearInterval(intervalId);
    };
  }, [filters.autoRefresh]);

  // Fetch pending verifications for admin
  const fetchPendingVerifications = async () => {
    try {
      const response = await authAPI.getVerificationRequests();
      console.log('📋 Pending verifications response:', response);
      if (response?.success) {
        setDashboardData(prev => ({
          ...prev,
          pendingVerifications: response.data || []
        }));
      }
    } catch (error) {
      console.error('Error fetching pending verifications:', error);
    }
  };

  // Fetch dashboard data from backend
  const fetchDashboardData = async (customFilters = null) => {
    const activeFilters = customFilters || filters;
    
    console.log('🚀 Fetching dashboard data with filters:', activeFilters);
    
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
      
      // Extract data from response
      let data = {};
      if (response && response.success) {
        data = response.data || response;
      } else if (response && !response.success) {
        console.error('API returned error:', response.message);
        throw new Error(response.message || 'Failed to fetch data');
      } else {
        data = response || {};
      }

      // Process the data
      const processedData = processDashboardData(data, shopsData);
      
      setDashboardData(prev => ({
        ...processedData,
        pendingVerifications: prev.pendingVerifications || []
      }));
      setDataTimestamp(new Date().toISOString());
      
      console.log('✅ Dashboard data processed successfully');
      
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

  // Process dashboard data from API response
  const processDashboardData = (data, shops) => {
    // Extract data with fallbacks
    const transactions = data?.salesWithProfit || data?.transactions || [];
    const financialStats = data?.financialStats || data?.summary || data?.financialStats || getDefaultStats();
    const products = data?.products || [];
    const cashiers = data?.cashiers || [];
    const credits = data?.credits || [];
    const expenses = data?.expenses || [];
    const shopPerformanceData = data?.performance?.shopPerformance || [];
    
    // Get shop names for display
    const shopMap = {};
    if (shops && shops.length > 0) {
      shops.forEach(shop => {
        shopMap[shop._id] = shop.name;
      });
    }

    // Process transactions for display
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

    // Low stock products
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

    // Top products from API or calculate
    let topProducts = data?.performance?.topProducts || [];
    if (!topProducts || topProducts.length === 0) {
      // Calculate from transactions
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

    // Shop performance - use from API or calculate
    let shopPerformance = shopPerformanceData;
    if (!shopPerformance || shopPerformance.length === 0) {
      // Calculate from transactions
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

    // Build business stats
    const businessStats = {
      totalProducts: products?.length || 0,
      totalShops: shops?.length || 0,
      totalCashiers: cashiers?.length || 0,
      lowStockCount: (products || []).filter(p => (p.currentStock || 0) <= (p.minStockLevel || 5)).length,
      activeCredits: (credits || []).filter(c => c.status !== 'paid' && (c.balanceDue || 0) > 0).length
    };

    // Build financial stats with defaults
    const enhancedFinancialStats = {
      totalRevenue: financialStats.totalRevenue || 0,
      totalSales: financialStats.totalSales || financialStats.totalRevenueCount || 0,
      netProfit: financialStats.netProfit || financialStats.totalProfit || 0,
      outstandingCredit: financialStats.outstandingCredit || 0,
      totalExpenses: financialStats.totalExpenses || 0,
      grossProfit: financialStats.grossProfit || financialStats.totalProfit || 0,
      creditSales: financialStats.creditSales || 0,
      nonCreditSales: financialStats.nonCreditSales || 0,
      totalCash: financialStats.totalCash || 0,
      totalMpesaBank: financialStats.totalMpesaBank || 0,
      profitMargin: financialStats.profitMargin || 0,
      totalItemsSold: financialStats.totalItemsSold || 0
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

  // Default stats
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
    totalItemsSold: 0
  });

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchDashboardData(newFilters);
  };

  // Quick refresh
  const quickRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDashboardData();
      await fetchPendingVerifications();
      message.success('Quick refresh completed');
    } catch (error) {
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
        navigate('/admin-login');
        message.success('Logged out successfully');
      }
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'KES 0';
    return `KES ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Table columns
  const salesColumns = [
    { 
      title: 'Transaction', 
      dataIndex: 'transactionNumber', 
      key: 'transactionNumber', 
      render: (text) => text || 'N/A' 
    },
    { 
      title: 'Date', 
      dataIndex: 'saleDate', 
      key: 'saleDate', 
      render: (date) => date ? new Date(date).toLocaleDateString() : 'N/A' 
    },
    { 
      title: 'Customer', 
      dataIndex: 'customerName', 
      key: 'customerName', 
      render: (name) => name || 'Walk-in' 
    },
    { 
      title: 'Amount', 
      dataIndex: 'totalAmount', 
      key: 'totalAmount', 
      render: (amount) => (
        <Tag color={amount > 0 ? 'green' : 'red'}>{formatCurrency(amount)}</Tag>
      )
    },
    { 
      title: 'Shop', 
      dataIndex: 'shop', 
      key: 'shop', 
      render: (text) => text || 'Unknown' 
    }
  ];

  const lowStockColumns = [
    { title: 'Product', dataIndex: 'name', key: 'name' },
    { 
      title: 'Stock', 
      dataIndex: 'currentStock', 
      key: 'currentStock',
      render: (stock) => (
        <Badge 
          count={stock || 0} 
          style={{ backgroundColor: stock <= 0 ? '#cf1322' : '#faad14' }}
        />
      )
    },
    { title: 'Min Level', dataIndex: 'minStockLevel', key: 'minStockLevel', render: (val) => val || 5 }
  ];

  // Menu items for sidebar
  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: 'products', icon: <ProductOutlined />, label: 'Products' },
    { key: 'shops', icon: <ShopOutlined />, label: 'Shops' },
    { key: 'cashiers', icon: <UserOutlined />, label: 'Cashiers' },
    { key: 'transactions', icon: <BarChartOutlined />, label: 'Transactions' },
    { key: 'expenses', icon: <DollarOutlined />, label: 'Expenses' },
    { key: 'inventory', icon: <AppstoreOutlined />, label: 'Inventory' },
    { key: 'credits', icon: <CreditCardOutlined />, label: 'Credits' },
    { 
      key: 'verify-device', 
      icon: <SafetyOutlined />, 
      label: (
        <span>
          Device Verify
          {dashboardData.pendingVerifications?.length > 0 && (
            <Badge 
              count={dashboardData.pendingVerifications.length} 
              style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }}
            />
          )}
        </span>
      )
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
        <div style={{ 
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
          selectedKeys={['dashboard']}
          mode="inline"
          items={menuItems}
          style={{ background: 'transparent', border: 'none' }}
          onClick={({ key }) => {
            if (key === 'dashboard') {
              navigate('/admin/dashboard');
            } else if (key === 'verify-device') {
              navigate('/admin/verify-device');
            } else {
              message.info(`Navigating to ${key}...`);
            }
          }}
        />
      </Sider>

      <Layout className="site-layout">
        <Header style={{ 
          background: '#1E293B',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64
        }}>
          <Title level={4} style={{ color: 'white', margin: 0, fontWeight: 'bold' }}>
            PAMELA - ADMIN
          </Title>
          <Space>
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
            
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" style={{ color: 'white' }}>
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
                  {dashboardData.pendingVerifications?.length > 0 && (
                    <Button 
                      type="primary" 
                      danger
                      icon={<SafetyOutlined />}
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
                            value={dashboardData.financialStats.totalRevenue || 0} 
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
                            value={dashboardData.financialStats.totalSales || 0} 
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
                            value={dashboardData.financialStats.netProfit || 0} 
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
                            value={dashboardData.financialStats.outstandingCredit || 0} 
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
                        <Button size="small" type="primary">
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
                        <Button size="small" type="primary">
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
                      icon={<SafetyOutlined />}
                      action={
                        <Button size="small" type="primary" onClick={() => navigate('/admin/verify-device')}>
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
                          placeholder="Search..."
                          size="small"
                          style={{ width: 120 }}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          allowClear
                        />
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
                      pagination={{ pageSize: 5, size: 'small' }}
                      size="small"
                      rowKey={(record) => record._id || record.id || `txn-${Math.random()}`}
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
                      rowKey={(record) => record._id || record.id || `prod-${Math.random()}`}
                      locale={{ emptyText: 'All products well stocked' }}
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
            </>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;