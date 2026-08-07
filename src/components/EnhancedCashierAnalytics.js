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
  Tooltip
} from 'antd';
import { 
  RiseOutlined, 
  FallOutlined, 
  UserOutlined, 
  ShoppingCartOutlined,
  CreditCardOutlined,
  DollarOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  CalendarOutlined,
  PhoneOutlined,
  MailOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { CalculationUtils } from '../../utils/calculationUtils';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const EnhancedCashierAnalytics = ({ 
  cashier, 
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

  // Calculate comprehensive cashier analytics
  const cashierAnalytics = useMemo(() => {
    if (!cashier) return getDefaultCashierAnalytics();

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
    return CalculationUtils.calculateCashierPerformanceWithCredits(
      filteredTransactions, 
      filteredCredits, 
      [cashier],
      { startDate: dateRange[0], endDate: dateRange[1] }
    )[0] || getDefaultCashierAnalytics();
  }, [cashier, transactions, credits, dateRange]);

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

  if (!cashier) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Title level={4} type="secondary">Select a cashier to view analytics</Title>
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
              <Avatar size={64} icon={<UserOutlined />} src={cashier.avatar} />
              <div>
                <Title level={2} style={{ margin: 0 }}>{cashier.name}</Title>
                <Space size="middle">
                  <Text><MailOutlined /> {cashier.email}</Text>
                  {cashier.phone && <Text><PhoneOutlined /> {cashier.phone}</Text>}
                  <Tag color={cashier.status === 'active' ? 'green' : 'red'}>
                    {cashier.status?.toUpperCase()}
                  </Tag>
                  {getRiskLevelTag(cashierAnalytics.riskLevel)}
                </Space>
              </div>
            </Space>
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Performance Period:</Text>
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
      {cashierAnalytics.performanceScore < 60 && (
        <Alert
          message="Performance Attention Needed"
          description={`Cashier performance score is ${cashierAnalytics.performanceScore}. Consider providing additional training or support.`}
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
              value={cashierAnalytics.performanceScore}
              suffix="/100"
              valueStyle={{ 
                color: CalculationUtils.getPerformanceScoreColor(cashierAnalytics.performanceScore)
              }}
            />
            <Progress 
              percent={cashierAnalytics.performanceScore} 
              status={cashierAnalytics.performanceScore >= 60 ? 'normal' : 'exception'}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={cashierAnalytics.totalRevenue}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />}
            />
            <Text type="secondary">{cashierAnalytics.totalTransactions} transactions</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Profit"
              value={cashierAnalytics.totalProfit}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              valueStyle={{ color: CalculationUtils.getProfitColor(cashierAnalytics.totalProfit) }}
              prefix={CalculationUtils.getProfitIcon(cashierAnalytics.totalProfit)}
            />
            <Text type="secondary">{cashierAnalytics.profitMargin.toFixed(1)}% margin</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Credit Management"
              value={cashierAnalytics.creditCollectionRate}
              suffix="%"
              valueStyle={{ 
                color: cashierAnalytics.creditCollectionRate >= 80 ? '#52c41a' : 
                       cashierAnalytics.creditCollectionRate >= 60 ? '#faad14' : '#cf1322'
              }}
              prefix={<CreditCardOutlined />}
            />
            <Text type="secondary">
              {CalculationUtils.formatCurrency(cashierAnalytics.outstandingCredit)} outstanding
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Detailed Analytics */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Credit Analysis */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <CreditCardOutlined />
                Credit Analysis
                <Badge count={cashierAnalytics.creditTransactions?.length || 0} />
              </Space>
            }
            loading={loading}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Total Credit Given"
                    value={cashierAnalytics.totalCreditGiven}
                    formatter={(value) => CalculationUtils.formatCurrency(value)}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Amount Collected"
                    value={cashierAnalytics.amountCollected}
                    formatter={(value) => CalculationUtils.formatCurrency(value)}
                  />
                </Col>
              </Row>
              <Divider />
              {cashierAnalytics.creditTransactions?.length > 0 ? (
                <List
                  size="small"
                  dataSource={cashierAnalytics.creditTransactions.slice(0, 5)}
                  renderItem={credit => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<UserOutlined />} />}
                        title={credit.customerName || 'Unknown Customer'}
                        description={
                          <Space direction="vertical" size={0}>
                            <Text>
                              Total: {CalculationUtils.formatCurrency(credit.totalAmount)} | 
                              Paid: {CalculationUtils.formatCurrency(credit.amountPaid)} | 
                              Due: {CalculationUtils.formatCurrency(credit.balanceDue)}
                            </Text>
                            <Text type="secondary">
                              Status: <Tag color={
                                credit.status === 'paid' ? 'green' : 
                                credit.status === 'partially_paid' ? 'blue' : 'orange'
                              }>
                                {credit.status?.replace('_', ' ').toUpperCase()}
                              </Tag>
                              {credit.dueDate && ` | Due: ${dayjs(credit.dueDate).format('DD/MM/YYYY')}`}
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

        {/* Top Products */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ShoppingCartOutlined />
                Top Selling Products
              </Space>
            }
            loading={loading}
          >
            {cashierAnalytics.topProducts?.length > 0 ? (
              <Table
                size="small"
                columns={productColumns}
                dataSource={cashierAnalytics.topProducts}
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

      {/* Daily Performance */}
      <Card 
        title={
          <Space>
            <BarChartOutlined />
            Daily Performance
            <Tag color="blue">{cashierAnalytics.dailyPerformance?.length || 0} days</Tag>
          </Space>
        }
        style={{ marginTop: 16 }}
        loading={loading}
      >
        {cashierAnalytics.dailyPerformance?.length > 0 ? (
          <Table
            size="small"
            columns={performanceColumns}
            dataSource={cashierAnalytics.dailyPerformance}
            pagination={{ pageSize: 7 }}
            scroll={{ x: true }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Text type="secondary">No daily performance data available</Text>
          </div>
        )}
      </Card>

      {/* Additional Metrics */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Items Sold"
              value={cashierAnalytics.itemsSold}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Average Transaction"
              value={cashierAnalytics.averageTransactionValue}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              prefix={<CalculatorOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Credit Sales"
              value={cashierAnalytics.creditSales}
              prefix={<CreditCardOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Default analytics structure
const getDefaultCashierAnalytics = () => ({
  cashierId: '',
  cashierName: '',
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
  riskLevel: 'low'
});

export default EnhancedCashierAnalytics;