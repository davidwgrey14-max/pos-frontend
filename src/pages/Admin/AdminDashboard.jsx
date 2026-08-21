// src/pages/Admin/AdminDashboard.jsx - FIXED STANDALONE VERSION
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
      totalMpesaBank: 0
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
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    let intervalId;
    if (filters.autoRefresh) {
      intervalId = setInterval(() => {
        fetchDashboardData();
        fetchPendingVerifications();
      }, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [filters.autoRefresh]);

  const fetchPendingVerifications = async () => {
    try {
      const response = await authAPI.getVerificationRequests();
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

  const fetchDashboardData = async (customFilters = null) => {
    const activeFilters = customFilters || filters;
    
    try {
      setLoading(true);
      setRefreshing(true);
      
      // Fetch shops
      const shopsData = await shopAPI.getAll();
      setShops(shopsData || []);

      // Build params
      const params = {};
      if (activeFilters.dateRange && activeFilters.dateRange[0] && activeFilters.dateRange[1]) {
        params.startDate = activeFilters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = activeFilters.dateRange[1].format('YYYY-MM-DD');
      }
      if (activeFilters.shop && activeFilters.shop !== 'all') {
        params.shopId = activeFilters.shop;
      }

      // Fetch comprehensive data
      const comprehensiveData = await unifiedAPI.getCombinedTransactions(params);
      
      // Process data
      const processedData = processDashboardData(comprehensiveData, shopsData);
      
      setDashboardData(prev => ({
        ...processedData,
        pendingVerifications: prev.pendingVerifications || []
      }));
      setDataTimestamp(new Date().toISOString());
      
    } catch (error) {
      console.error('Dashboard fetch failed:', error);
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processDashboardData = (data, shops) => {
    const transactions = data?.salesWithProfit || [];
    const products = data?.products || [];
    const cashiers = data?.cashiers || [];
    const credits = data?.credits || [];
    const expenses = data?.expenses || [];
    
    // Calculate financial stats
    const financialStats = {
      totalRevenue: transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
      totalSales: transactions.length,
      netProfit: transactions.reduce((sum, t) => sum + (t.profit || 0), 0),
      outstandingCredit: credits.reduce((sum, c) => sum + (c.balanceDue || 0), 0),
      totalExpenses: expenses.reduce((sum, e) => sum + (e.amount || 0), 0) || 0,
      grossProfit: transactions.reduce((sum, t) => sum + (t.grossProfit || 0), 0),
      creditSales: transactions.filter(t => t.isCreditTransaction).length,
      nonCreditSales: transactions.filter(t => !t.isCreditTransaction).length,
      totalCash: transactions.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + (t.totalAmount || 0), 0),
      totalMpesaBank: transactions.filter(t => t.paymentMethod === 'mpesa' || t.paymentMethod === 'bank').reduce((sum, t) => sum + (t.totalAmount || 0), 0)
    };

    // Recent transactions
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.saleDate || b.createdAt) - new Date(a.saleDate || a.createdAt))
      .slice(0, 10);

    // Low stock products
    const lowStockProducts = products
      .filter(p => (p.currentStock || 0) <= (p.minStockLevel || 5))
      .slice(0, 5);

    // Top products
    const productMap = {};
    transactions.forEach(t => {
      t.items?.forEach(item => {
        const id = item.productId?.toString() || item.productName;
        if (!productMap[id]) {
          productMap[id] = { 
            name: item.productName || 'Unknown', 
            totalSold: 0, 
            totalRevenue: 0,
            totalProfit: 0
          };
        }
        const quantity = item.quantity || 1;
        const revenue = item.totalPrice || (item.price * quantity);
        const cost = (item.buyingPrice || 0) * quantity;
        productMap[id].totalSold += quantity;
        productMap[id].totalRevenue += revenue;
        productMap[id].totalProfit += (revenue - cost);
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5);

    // Shop performance
    const shopMap = {};
    transactions.forEach(t => {
      const shopId = t.shop || t.shopId;
      if (!shopId) return;
      if (!shopMap[shopId]) {
        const shop = shops?.find(s => s._id?.toString() === shopId?.toString()) || { name: 'Unknown' };
        shopMap[shopId] = { 
          name: shop.name || 'Unknown', 
          revenue: 0, 
          transactions: 0,
          profit: 0
        };
      }
      shopMap[shopId].revenue += t.totalAmount || 0;
      shopMap[shopId].transactions += 1;
      shopMap[shopId].profit += t.profit || 0;
    });
    const shopPerformance = Object.values(shopMap)
      .sort((a, b) => b.revenue - a.revenue);

    return {
      financialStats,
      businessStats: {
        totalProducts: products.length,
        totalShops: shops?.length || 0,
        totalCashiers: cashiers.length,
        lowStockCount: lowStockProducts.length,
        activeCredits: credits.filter(c => c.status !== 'paid' && (c.balanceDue || 0) > 0).length
      },
      recentTransactions,
      lowStockProducts,
      topProducts,
      shopPerformance
    };
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchDashboardData(newFilters);
  };

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

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'KES 0';
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
        <Tag color="green">{formatCurrency(amount)}</Tag>
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