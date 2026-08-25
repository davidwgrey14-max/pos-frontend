// src/components/EnhancedCashierAnalytics.js
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
  Empty
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
  ExclamationCircleOutlined,
  ShopOutlined,
  SwapOutlined
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
  onDateRangeChange,
  onShopFilterChange
}) => {
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedShopFilter, setSelectedShopFilter] = useState('all');

  // Get assigned shops for filtering
  const assignedShops = useMemo(() => {
    if (!cashier) return [];
    // Check for assignedShops in different formats
    const shops = cashier.assignedShops || [];
    return shops.filter(s => s.isActive !== false);
  }, [cashier]);

  // Calculate comprehensive cashier analytics with shop filtering
  const cashierAnalytics = useMemo(() => {
    if (!cashier) return getDefaultCashierAnalytics();

    // Filter transactions by date range
    let filteredTransactions = transactions.filter(t => {
      const transactionDate = dayjs(t.saleDate || t.createdAt);
      return transactionDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
    });

    // Apply shop filter if selected
    if (selectedShopFilter !== 'all') {
      filteredTransactions = filteredTransactions.filter(t => {
        // Check multiple possible shop ID fields
        const tShopId = t.shop || t.shopId || t.shop?._id || t.shopId?._id;
        return tShopId === selectedShopFilter;
      });
    }

    // Filter credits by date range
    let filteredCredits = credits.filter(c => {
      const creditDate = dayjs(c.createdAt || c.transactionDate);
      return creditDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
    });

    // Apply shop filter to credits
    if (selectedShopFilter !== 'all') {
      filteredCredits = filteredCredits.filter(c => {
        const cShopId = c.shop || c.shopId || c.shop?._id || c.shopId?._id;
        return cShopId === selectedShopFilter;
      });
    }

    // Calculate metrics using CalculationUtils
    const result = CalculationUtils.calculateCashierPerformanceWithCredits(
      filteredTransactions, 
      filteredCredits, 
      [cashier],
      { 
        startDate: dateRange[0], 
        endDate: dateRange[1],
        shopId: selectedShopFilter !== 'all' ? selectedShopFilter : null
      }
    );

    const analytics = result && result[0] ? result[0] : getDefaultCashierAnalytics();
    
    // Add shop filter info
    analytics.shopFilter = selectedShopFilter;
    analytics.shopCount = assignedShops.length;
    analytics.filteredShopName = selectedShopFilter !== 'all' 
      ? assignedShops.find(s => (s.shopId || s._id) === selectedShopFilter)?.name || 'Selected Shop'
      : 'All Shops';
    
    return analytics;
  }, [cashier, transactions, credits, dateRange, selectedShopFilter, assignedShops]);

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

  const handleShopFilterChange = (value) => {
    setSelectedShopFilter(value);
    if (onShopFilterChange) {
      onShopFilterChange(value);
    }
  };

  const getRiskLevelTag = (riskLevel) => {
    const color = riskLevel === 'high' ? 'red' : 
                  riskLevel === 'medium' ? 'orange' : 
                  riskLevel === 'low' ? 'green' : 'default';
    const text = riskLevel?.toUpperCase() || 'UNKNOWN';
    return <Tag color={color}>{text}</Tag>;
  };

  const getPerformanceScoreColor = (score) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#cf1322';
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
        <Text style={{ color: profit >= 0 ? '#3f8600' : '#cf1322' }}>
          {CalculationUtils.formatCurrency(profit)}
        </Text>
      )
    },
    {
      title: 'Credit Sales',
      dataIndex: 'creditSales',
      key: 'creditSales'
    },
    {
      title: 'Shop',
      dataIndex: 'shopName',
      key: 'shopName',
      render: (shopName) => shopName || 'N/A'
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
    },
    {
      title: 'Profit',
      dataIndex: 'profit',
      key: 'profit',
      render: (profit) => (
        <Text style={{ color: profit >= 0 ? '#3f8600' : '#cf1322' }}>
          {CalculationUtils.formatCurrency(profit)}
        </Text>
      )
    }
  ];

  if (!cashier) {
    return (
      <Card>
        <Empty 
          description="Select a cashier to view analytics" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header Section */}
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Space size="large" wrap>
              <Avatar size={64} icon={<UserOutlined />} src={cashier.avatar} />
              <div>
                <Title level={2} style={{ margin: 0 }}>{cashier.name}</Title>
                <Space size="middle" wrap>
                  <Text><MailOutlined /> {cashier.email}</Text>
                  {cashier.phone && <Text><PhoneOutlined /> {cashier.phone}</Text>}
                  <Tag color={cashier.status === 'active' ? 'green' : 'red'}>
                    {cashier.status?.toUpperCase()}
                  </Tag>
                  {getRiskLevelTag(cashierAnalytics.riskLevel)}
                  {assignedShops.length > 1 && (
                    <Tag color="purple" icon={<SwapOutlined />}>
                      Multi-Shop Access
                    </Tag>
                  )}
                  {selectedShopFilter !== 'all' && (
                    <Tag color="blue" icon={<ShopOutlined />}>
                      {cashierAnalytics.filteredShopName}
                    </Tag>
                  )}
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">
                    Assigned to {assignedShops.length} shop{assignedShops.length !== 1 ? 's' : ''}
                  </Text>
                </div>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Text strong>Performance Period:</Text>
              <Space wrap>
                <Select 
                  value={timeRange} 
                  onChange={handleTimeRangeChange} 
                  style={{ width: 120 }}
                >
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
              {/* Shop Filter - Only show if cashier has multiple shops */}
              {assignedShops.length > 1 && (
                <Space>
                  <Text strong>Shop:</Text>
                  <Select 
                    value={selectedShopFilter}
                    onChange={handleShopFilterChange}
                    style={{ width: 180 }}
                    placeholder="Select shop"
                  >
                    <Option value="all">All Assigned Shops</Option>
                    {assignedShops.map(shop => (
                      <Option key={shop.shopId || shop._id} value={shop.shopId || shop._id}>
                        {shop.name || shop.shopName}
                      </Option>
                    ))}
                  </Select>
                </Space>
              )}
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
          action={
            <Button size="small" type="primary">
              View Details
            </Button>
          }
        />
      )}

      {/* Shop Filter Indicator */}
      {selectedShopFilter !== 'all' && (
        <Alert
          message={`Showing data for: ${cashierAnalytics.filteredShopName}`}
          description="Data is filtered to show transactions from this shop only."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          closable
          onClose={() => handleShopFilterChange('all')}
        />
      )}

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Performance Score"
              value={Math.round(cashierAnalytics.performanceScore || 0)}
              suffix="/100"
              valueStyle={{ 
                color: getPerformanceScoreColor(cashierAnalytics.performanceScore || 0)
              }}
            />
            <Progress 
              percent={Math.min(100, cashierAnalytics.performanceScore || 0)} 
              status={cashierAnalytics.performanceScore >= 60 ? 'normal' : 'exception'}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={cashierAnalytics.totalRevenue || 0}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />}
            />
            <Text type="secondary">{cashierAnalytics.totalTransactions || 0} transactions</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Total Profit"
              value={cashierAnalytics.totalProfit || 0}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              valueStyle={{ color: (cashierAnalytics.totalProfit || 0) >= 0 ? '#3f8600' : '#cf1322' }}
              prefix={(cashierAnalytics.totalProfit || 0) >= 0 ? <RiseOutlined /> : <FallOutlined />}
            />
            <Text type="secondary">{(cashierAnalytics.profitMargin || 0).toFixed(1)}% margin</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title="Credit Collection"
              value={cashierAnalytics.creditCollectionRate || 0}
              suffix="%"
              valueStyle={{ 
                color: (cashierAnalytics.creditCollectionRate || 0) >= 80 ? '#52c41a' : 
                       (cashierAnalytics.creditCollectionRate || 0) >= 60 ? '#faad14' : '#cf1322'
              }}
              prefix={<CreditCardOutlined />}
            />
            <Text type="secondary">
              {CalculationUtils.formatCurrency(cashierAnalytics.outstandingCredit || 0)} outstanding
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
                    value={cashierAnalytics.totalCreditGiven || 0}
                    formatter={(value) => CalculationUtils.formatCurrency(value)}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Amount Collected"
                    value={cashierAnalytics.amountCollected || 0}
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
                            <Space>
                              <Text type="secondary">
                                Status: 
                              </Text>
                              <Tag color={
                                credit.status === 'paid' ? 'green' : 
                                credit.status === 'partially_paid' ? 'blue' : 'orange'
                              }>
                                {credit.status?.replace('_', ' ').toUpperCase()}
                              </Tag>
                              {credit.dueDate && (
                                <Text type="secondary">
                                  | Due: {dayjs(credit.dueDate).format('DD/MM/YYYY')}
                                </Text>
                              )}
                              {credit.shopName && (
                                <Tag color="geekblue" size="small">
                                  {credit.shopName}
                                </Tag>
                              )}
                            </Space>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty 
                  description="No credit transactions in selected period" 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
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
                pagination={{ pageSize: 5 }}
                scroll={{ y: 240 }}
              />
            ) : (
              <Empty 
                description="No product sales data available" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
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
            {selectedShopFilter !== 'all' && (
              <Tag color="green">Filtered</Tag>
            )}
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
          <Empty 
            description="No daily performance data available" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* Additional Metrics */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Items Sold"
              value={cashierAnalytics.itemsSold || 0}
              prefix={<ShoppingCartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Average Transaction"
              value={cashierAnalytics.averageTransactionValue || 0}
              formatter={(value) => CalculationUtils.formatCurrency(value)}
              prefix={<CalculatorOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <Statistic
              title="Credit Sales"
              value={cashierAnalytics.creditSales || 0}
              prefix={<CreditCardOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Shop Performance Summary (if multi-shop) */}
      {assignedShops.length > 1 && selectedShopFilter === 'all' && (
        <Card 
          title={
            <Space>
              <ShopOutlined />
              Shop Performance Breakdown
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          <Row gutter={[16, 16]}>
            {assignedShops.map(shop => {
              // Calculate per-shop metrics
              const shopTransactions = transactions.filter(t => {
                const tShopId = t.shop || t.shopId || t.shop?._id || t.shopId?._id;
                return tShopId === (shop.shopId || shop._id);
              });
              
              const shopRevenue = shopTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
              const shopCount = shopTransactions.length;
              
              return (
                <Col xs={24} sm={12} md={8} key={shop.shopId || shop._id}>
                  <Card size="small" hoverable>
                    <Statistic
                      title={shop.name || shop.shopName}
                      value={shopRevenue}
                      formatter={(value) => CalculationUtils.formatCurrency(value)}
                      valueStyle={{ color: '#1890ff', fontSize: '18px' }}
                    />
                    <Text type="secondary">{shopCount} transactions</Text>
                    <br />
                    <Tooltip title="Click to filter by this shop">
                      <Button 
                        type="link" 
                        size="small"
                        onClick={() => handleShopFilterChange(shop.shopId || shop._id)}
                      >
                        View Details
                      </Button>
                    </Tooltip>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}
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
  riskLevel: 'low',
  shopFilter: 'all',
  shopCount: 0,
  filteredShopName: 'All Shops'
});

export default EnhancedCashierAnalytics;