import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Tag, 
  Progress, 
  List, 
  Avatar, 
  Space, 
  Typography, 
  DatePicker,
  Select,
  Badge,
  Divider,
  Alert,
  Tooltip,
  Tabs
} from 'antd';
import { 
  RiseOutlined, 
  FallOutlined, 
  ShopOutlined, 
  ShoppingCartOutlined,
  CreditCardOutlined,
  DollarOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  CalendarOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { CalculationUtils } from '../../utils/calculationUtils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

const EnhancedShopAnalytics = ({ 
  shop, 
  transactions = [], 
  credits = [], 
  loading = false,
  onDateRangeChange 
}) => {
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate comprehensive shop analytics
  const shopAnalytics = useMemo(() => {
    if (!shop) return getDefaultShopAnalytics();

    // Filter data by date range
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = dayjs(t.saleDate || t.createdAt);
      return transactionDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
    });

    const filteredCredits = credits.filter(c => {
      const creditDate = dayjs(c.createdAt || c.transactionDate);
      return creditDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
    });

    // Calculate metrics using CalculationUtils
    return CalculationUtils.calculateShopPerformanceWithCredits(
      filteredTransactions, 
      filteredCredits, 
      [shop],
      { startDate: dateRange[0], endDate: dateRange[1] }
    )[0] || getDefaultShopAnalytics();
  }, [shop, transactions, credits, dateRange]);

  const handleTimeRangeChange = (value) => {
    setTimeRange(value);
    const now = dayjs();
    let startDate;

    switch (value) {
      case 'today':
        startDate = now.startOf('day');
        break;
      case '7d':
        startDate = now.subtract(7, 'days');
        break;
      case '30d':
        startDate = now.subtract(30, 'days');
        break;
      case '90d':
        startDate = now.subtract(90, 'days');
        break;
      default:
        startDate = now.subtract(30, 'days');
    }

    const newRange = [startDate, now];
    setDateRange(newRange);
    if (onDateRangeChange) {
      onDateRangeChange(newRange);
    }
  };

  const handleCustomDateChange = (dates) => {
    setDateRange(dates);
    setTimeRange('custom');
    if (onDateRangeChange) {
      onDateRangeChange(dates);
    }
  };

  const getRiskLevelTag = (riskLevel) => {
    const color = CalculationUtils.getRiskLevelColor(riskLevel);
    const text = riskLevel?.toUpperCase() || 'UNKNOWN';
    return <Tag color={color}>{text}</Tag>;
  };

  const performanceColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date) => dayjs(date).format('DD MMM YYYY')
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (amount) => CalculationUtils.formatCurrency(amount)
    },
    {
      title: 'Transactions',
      dataIndex: 'transactions',
      key: 'transactions'
    },
    {
      title: 'Profit',
      dataIndex: 'profit',
      key: 'profit',
      render: (profit) => (
        <Text style={{ color: CalculationUtils.getProfitColor(profit) }}>
          {CalculationUtils.formatCurrency(profit)}
        </Text>
      )
    },
    {
      title: 'Credit Sales',
      dataIndex: 'creditSales',
      key: 'creditSales'
    }
  ];

  const productColumns = [
    {
      title: 'Product',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity'
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (amount) => CalculationUtils.formatCurrency(amount)
    }
  ];

  const cashierColumns = [
    {
      title: 'Cashier',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Transactions',
      dataIndex: 'transactions',
      key: 'transactions'
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (amount) => CalculationUtils.formatCurrency(amount)
    },
    {
      title: 'Avg. Transaction',
      key: 'average',
      render: (_, record) => CalculationUtils.formatCurrency(record.revenue / record.transactions)
    }
  ];

  if (!shop) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Title level={4} type="secondary">Select a shop to view analytics</Title>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header Section */}
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col span={16}>
            <Space size="large">
              <Avatar size={64} icon={<ShopOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <div>
                <Title level={2} style={{ margin: 0 }}>{shop.name}</Title>
                <Space size="middle">
                  <Text><EnvironmentOutlined /> {shop.location}</Text>
                  <Tag color="green">ACTIVE</Tag>
                  {getRiskLevelTag(shopAnalytics.riskLevel)}
                </Space>
              </div>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Analysis Period:</Text>
              <Space>
                <Select value={timeRange} onChange={handleTimeRangeChange} style={{ width: 120 }}>
                  <Option value="today">Today</Option>
                  <Option value="7d">Last 7 Days</Option>
                  <Option value="30d">Last 30 Days</Option>
                  <Option value="90d">Last 90 Days</Option>
                  <Option value="custom">Custom</Option>
                </Select>
                {timeRange === 'custom' && (
                  <RangePicker
                    value={dateRange}
                    onChange={handleCustomDateChange}
                    format="DD/MM/YYYY"
                  />
                )}
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Performance Score Alert */}
      {shopAnalytics.performanceScore < 60 && (
        <Alert
          message="Shop Performance Attention Needed"
          description={`Shop performance score is ${shopAnalytics.performanceScore}. Review operations and credit management.`}
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Performance Score"
              value={shopAnalytics.performanceScore}
              suffix="/100"
              valueStyle={{ 
                color: CalculationUtils.getPerformanceScoreColor(shopAnalytics.performanceScore)
              }}
            />
            <Progress 
              percent={shopAnalytics.performanceScore} 
              status={shopAnalytics.performanceScore >= 60 ? 'normal' : 'exception'}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={shopAnalytics.totalRevenue}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />}
            />
            <Text type="secondary">{shopAnalytics.totalTransactions} transactions</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Profit"
              value={shopAnalytics.totalProfit}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              valueStyle={{ color: CalculationUtils.getProfitColor(shopAnalytics.totalProfit) }}
              prefix={CalculationUtils.getProfitIcon(shopAnalytics.totalProfit)}
            />
            <Text type="secondary">{shopAnalytics.profitMargin.toFixed(1)}% margin</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Credit Management"
              value={shopAnalytics.creditCollectionRate}
              suffix="%"
              valueStyle={{ 
                color: shopAnalytics.creditCollectionRate >= 80 ? '#52c41a' : 
                       shopAnalytics.creditCollectionRate >= 60 ? '#faad14' : '#cf1322'
              }}
              prefix={<CreditCardOutlined />}
            />
            <Text type="secondary">
              {CalculationUtils.formatCurrency(shopAnalytics.outstandingCredit)} outstanding
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Detailed Analytics Tabs */}
      <Card style={{ marginTop: 16 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Overview" key="overview">
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card title="Credit Analysis" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic
                          title="Total Credit Given"
                          value={shopAnalytics.totalCreditGiven}
                          formatter={(value) => CalculationUtils.formatCurrency(value)}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="Amount Collected"
                          value={shopAnalytics.amountCollected}
                          formatter={(value) => CalculationUtils.formatCurrency(value)}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="Active Credits"
                          value={shopAnalytics.creditTransactions?.length || 0}
                        />
                      </Col>
                    </Row>
                    <Divider />
                    {shopAnalytics.creditTransactions?.length > 0 ? (
                      <List
                        size="small"
                        dataSource={shopAnalytics.creditTransactions.slice(0, 5)}
                        renderItem={credit => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={<Avatar icon={<TeamOutlined />} />}
                              title={credit.customerName || 'Unknown Customer'}
                              description={
                                <Space direction="vertical" size={0}>
                                  <Text>
                                    Total: {CalculationUtils.formatCurrency(credit.totalAmount)} | 
                                    Paid: {CalculationUtils.formatCurrency(credit.amountPaid)} | 
                                    Due: {CalculationUtils.formatCurrency(credit.balanceDue)}
                                  </Text>
                                  <Text type="secondary">
                                    Cashier: {credit.cashierName} | 
                                    Status: <Tag color={
                                      credit.status === 'paid' ? 'green' : 
                                      credit.status === 'partially_paid' ? 'blue' : 'orange'
                                    }>
                                      {credit.status?.replace('_', ' ').toUpperCase()}
                                    </Tag>
                                  </Text>
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Text type="secondary">No credit transactions in selected period</Text>
                      </div>
                    )}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card title="Top Products" size="small">
                  {shopAnalytics.topProducts?.length > 0 ? (
                    <Table
                      size="small"
                      columns={productColumns}
                      dataSource={shopAnalytics.topProducts}
                      pagination={false}
                      scroll={{ y: 240 }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Text type="secondary">No product sales data available</Text>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="Performance" key="performance">
            <Card title="Daily Performance" size="small">
              {shopAnalytics.dailyPerformance?.length > 0 ? (
                <Table
                  size="small"
                  columns={performanceColumns}
                  dataSource={shopAnalytics.dailyPerformance}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: true }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Text type="secondary">No daily performance data available</Text>
                </div>
              )}
            </Card>
          </TabPane>

          <TabPane tab="Cashiers" key="cashiers">
            <Card title="Top Performing Cashiers" size="small">
              {shopAnalytics.topCashiers?.length > 0 ? (
                <Table
                  size="small"
                  columns={cashierColumns}
                  dataSource={shopAnalytics.topCashiers}
                  pagination={false}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Text type="secondary">No cashier data available</Text>
                </div>
              )}
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      {/* Additional Metrics */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Items Sold"
              value={shopAnalytics.itemsSold}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Average Transaction"
              value={shopAnalytics.averageTransactionValue}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              prefix={<CalculatorOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Credit Sales"
              value={shopAnalytics.creditSales}
              prefix={<CreditCardOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Default analytics structure
const getDefaultShopAnalytics = () => ({
  shopId: '',
  shopName: '',
  location: '',
  totalRevenue: 0,
  totalTransactions: 0,
  totalProfit: 0,
  totalCost: 0,
  itemsSold: 0,
  creditSales: 0,
  creditRevenue: 0,
  outstandingCredit: 0,
  totalCreditGiven: 0,
  amountCollected: 0,
  creditCollectionRate: 0,
  creditTransactions: [],
  immediateRevenue: 0,
  averageTransactionValue: 0,
  performanceScore: 0,
  profitMargin: 0,
  dailyPerformance: [],
  topProducts: [],
  topCashiers: [],
  riskLevel: 'low'
});

export default EnhancedShopAnalytics;