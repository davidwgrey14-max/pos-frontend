// src/pages/Manager/ManagerDashboard.jsx - FULLY FIXED
import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout, Card, Row, Col, Statistic, Typography, Tag, Space,
  Button, Spin, Alert, Divider, List, Avatar,
  Tabs, Input, Modal, Form, message, Descriptions,
  Progress, Badge, Timeline, DatePicker, Table, Select
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
  AppstoreOutlined, PieChartOutlined, LineChartOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { unifiedAPI, productAPI, creditAPI, transactionAPI, expenseAPI } from '../../services/api';
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

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [manager, setManager] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);

  useEffect(() => {
    const managerData = JSON.parse(localStorage.getItem('managerData') || localStorage.getItem('userData') || 'null');
    if (!managerData || managerData.role !== 'manager') {
      navigate('/cashier-login');
      return;
    }
    setManager(managerData);
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsData, expensesData, transactionsData] = await Promise.all([
        productAPI.getAll(),
        expenseAPI.getAll(),
        unifiedAPI.getCombinedTransactions({ 
          startDate: dateRange[0]?.format('YYYY-MM-DD') || dayjs().subtract(30, 'days').format('YYYY-MM-DD'), 
          endDate: dateRange[1]?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD') 
        })
      ]);
      setProducts(productsData || []);
      setExpenses(expensesData || []);
      setTransactions(transactionsData.transactions || transactionsData.salesWithProfit || []);
    } catch (error) {
      console.error('Error fetching manager data:', error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('managerData');
    localStorage.removeItem('managerToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('userToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('sessionToken');
    navigate('/cashier-login');
  };

  // Calculate low stock products - with safe fallback
  const lowStockProducts = useMemo(() => {
    return (products || []).filter(p => 
      (p.currentStock || 0) > 0 && 
      (p.currentStock || 0) <= (p.minStockLevel || CONFIG.STOCK_ALERTS.LOW_STOCK_THRESHOLD || 5)
    );
  }, [products]);

  const outOfStockProducts = useMemo(() => {
    return (products || []).filter(p => (p.currentStock || 0) === 0);
  }, [products]);

  // Calculate dead stock (not sold in 30 days) - with safe fallback
  const deadStockProducts = useMemo(() => {
    const deadStockDays = CONFIG.STOCK_ALERTS.DEAD_STOCK_DAYS || 30;
    const cutoffDate = dayjs().subtract(deadStockDays, 'days');
    return (products || []).filter(p => {
      const lastSold = p.lastSoldAt ? dayjs(p.lastSoldAt) : null;
      return !lastSold || lastSold.isBefore(cutoffDate);
    });
  }, [products]);

  // Total expenses
  const totalExpenses = useMemo(() => {
    return (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  // Sales trends (for manager - no profit/loss shown)
  const salesTrends = useMemo(() => {
    const dailySales = {};
    (transactions || []).forEach(t => {
      const date = dayjs(t.saleDate || t.createdAt).format('YYYY-MM-DD');
      if (!dailySales[date]) {
        dailySales[date] = { revenue: 0, count: 0 };
      }
      dailySales[date].revenue += t.totalAmount || 0;
      dailySales[date].count += 1;
    });
    return Object.entries(dailySales).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // Trend indicator (no absolute profit values)
  const getTrendStatus = (current, previous) => {
    if (!previous || previous === 0) return { status: 'neutral', message: 'No previous data' };
    const change = ((current - previous) / previous) * 100;
    if (change > 0) return { status: 'up', message: `Sales up ${Math.abs(change).toFixed(1)}%` };
    if (change < 0) return { status: 'down', message: `Sales down ${Math.abs(change).toFixed(1)}%` };
    return { status: 'neutral', message: 'Sales stable' };
  };

  const recentTrend = salesTrends.length >= 2 
    ? getTrendStatus(salesTrends[salesTrends.length-1]?.revenue || 0, salesTrends[salesTrends.length-2]?.revenue || 0)
    : { status: 'neutral', message: 'Insufficient data' };

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

  // Transaction columns (no profit shown)
  const transactionColumns = [
    { title: 'Date', dataIndex: 'saleDate', key: 'date', render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A' },
    { title: 'Customer', dataIndex: 'customerName', key: 'customer', render: (name) => name || 'Walk-in' },
    { title: 'Items', dataIndex: 'itemsCount', key: 'items' },
    { title: 'Amount', dataIndex: 'totalAmount', key: 'amount', render: (amount) => `KES ${(amount || 0).toLocaleString()}` },
    { title: 'Payment', dataIndex: 'paymentMethod', key: 'payment', render: (method) => <Tag color={method === 'cash' ? 'green' : 'blue'}>{method?.toUpperCase() || 'UNKNOWN'}</Tag> },
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" tip="Loading dashboard..." />
      </Layout>
    );
  }

  const totalRevenue = (transactions || []).reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const totalTransactions = (transactions || []).length;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>Manager Dashboard</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} danger>Logout</Button>
        </Space>
      </Header>

      <Content style={{ padding: '24px', background: '#f5f5f5' }}>
        {/* Welcome Card */}
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Avatar size="large" icon={<UserOutlined />} />
            <div>
              <Title level={4} style={{ margin: 0 }}>Welcome, {manager?.name || 'Manager'}!</Title>
              <Text type="secondary">Date: {dayjs().format('DD/MM/YYYY')}</Text>
            </div>
          </Space>
        </Card>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* Dashboard Tab */}
          <TabPane tab={<span><BarChartOutlined /> Dashboard</span>} key="dashboard">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic 
                    title="Total Sales (30 days)" 
                    value={totalRevenue} 
                    formatter={(v) => `KES ${v?.toLocaleString()}`} 
                    valueStyle={{ color: '#1890ff' }} 
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic 
                    title="Total Transactions" 
                    value={totalTransactions} 
                    valueStyle={{ color: '#52c41a' }} 
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic 
                    title="Total Expenses" 
                    value={totalExpenses} 
                    formatter={(v) => `KES ${v?.toLocaleString()}`} 
                    valueStyle={{ color: '#fa8c16' }} 
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic 
                    title="Low Stock Items" 
                    value={lowStockProducts.length} 
                    valueStyle={{ color: lowStockProducts.length > 0 ? '#fa8c16' : '#52c41a' }} 
                  />
                </Card>
              </Col>
            </Row>

            {/* Sales Trend */}
            <Card title={<Space><LineChartOutlined /> Sales Trend</Space>} style={{ marginTop: 16 }}>
              <Alert 
                message={`Trend: ${recentTrend.message}`} 
                type={recentTrend.status === 'up' ? 'success' : recentTrend.status === 'down' ? 'warning' : 'info'} 
                showIcon 
                style={{ marginBottom: 16 }} 
              />
              <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {salesTrends.length > 0 ? (
                  <div style={{ width: '100%', padding: '20px' }}>
                    <Text>Sales are trending {recentTrend.status === 'up' ? 'up' : recentTrend.status === 'down' ? 'down' : 'stable'} over the selected period.</Text>
                    <div style={{ marginTop: '10px' }}>
                      {salesTrends.slice(-7).map((day, idx) => {
                        const maxRevenue = Math.max(...salesTrends.map(d => d.revenue), 1);
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ width: 80 }}>{day.date}</Text>
                            <Progress 
                              percent={Math.min(100, (day.revenue / maxRevenue) * 100)} 
                              size="small" 
                              format={() => `KES ${day.revenue.toLocaleString()}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <Text type="secondary">No sales data available</Text>
                )}
              </div>
            </Card>
          </TabPane>

          {/* Stock Alerts Tab */}
          <TabPane 
            tab={<span><WarningOutlined /> Stock Alerts <Badge count={lowStockProducts.length + outOfStockProducts.length} /></span>} 
            key="stock"
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card 
                  title={<Space><WarningOutlined /> Low Stock Items</Space>} 
                  extra={<Badge count={lowStockProducts.length} showZero color="orange" />}
                >
                  {lowStockProducts.length > 0 ? (
                    <Table columns={stockColumns} dataSource={lowStockProducts} rowKey="_id" pagination={false} size="small" />
                  ) : (
                    <Text type="secondary">No low stock items found.</Text>
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card 
                  title={<Space><WarningOutlined /> Out of Stock</Space>} 
                  extra={<Badge count={outOfStockProducts.length} showZero color="red" />}
                >
                  {outOfStockProducts.length > 0 ? (
                    <Table columns={stockColumns} dataSource={outOfStockProducts} rowKey="_id" pagination={false} size="small" />
                  ) : (
                    <Text type="secondary">No out of stock items found.</Text>
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>

          {/* Dead Stock Tab */}
          <TabPane 
            tab={<span><InfoCircleOutlined /> Dead Stock <Badge count={deadStockProducts.length} /></span>} 
            key="deadStock"
          >
            <Card title="Dead Stock Recommendations">
              <Alert 
                message={`Products not sold in ${CONFIG.STOCK_ALERTS.DEAD_STOCK_DAYS || 30} days should be promoted or advertised.`} 
                type="info" 
                showIcon 
                style={{ marginBottom: 16 }} 
              />
              {deadStockProducts.length > 0 ? (
                <Table columns={deadStockColumns} dataSource={deadStockProducts} rowKey="_id" pagination={false} />
              ) : (
                <Text type="secondary">No dead stock detected - all products are selling well!</Text>
              )}
            </Card>
          </TabPane>

          {/* Expenses Tab */}
          <TabPane tab={<span><DollarOutlined /> Expenses</span>} key="expenses">
            <Card 
              title="Expenses" 
              extra={
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/manager/expenses')}>
                  Manage Expenses
                </Button>
              }
            >
              {expenses.length > 0 ? (
                <Table columns={expenseColumns} dataSource={expenses} rowKey="_id" pagination={{ pageSize: 10 }} />
              ) : (
                <Text type="secondary">No expenses recorded.</Text>
              )}
            </Card>
          </TabPane>

          {/* Transactions Tab */}
          <TabPane tab={<span><TransactionOutlined /> Transactions</span>} key="transactions">
            <Card title="Recent Transactions">
              {transactions.length > 0 ? (
                <Table 
                  columns={transactionColumns} 
                  dataSource={[...transactions].slice(-20).reverse()} 
                  rowKey="_id" 
                  pagination={{ pageSize: 10 }} 
                />
              ) : (
                <Text type="secondary">No transactions found.</Text>
              )}
            </Card>
          </TabPane>
        </Tabs>
      </Content>
    </Layout>
  );
};

export default ManagerDashboard;