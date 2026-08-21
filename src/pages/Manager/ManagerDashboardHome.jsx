// src/pages/Manager/ManagerDashboardHome.jsx
import React from 'react';
import { Typography, Card, Row, Col, Statistic, Tag, Space } from 'antd';
import { 
  AppstoreOutlined, 
  WarningOutlined, 
  DollarOutlined,
  LineChartOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const ManagerDashboardHome = () => {
  return (
    <div>
      <Title level={3}>Manager Overview</Title>
      <Text type="secondary">Welcome to your manager dashboard. You can manage inventory and expenses but cannot see profit figures.</Text>
      
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic title="Stock Alerts" value={0} prefix={<WarningOutlined />} valueStyle={{ color: '#fa8c16' }} />
            <Text type="secondary">Low stock alerts will appear here</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic title="Total Products" value={0} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic title="Total Expenses" value={0} prefix={<DollarOutlined />} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ManagerDashboardHome;