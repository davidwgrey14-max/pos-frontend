// src/pages/Admin/AdminDashboard.jsx - MINIMAL DEBUG VERSION
import React, { useState, useEffect } from 'react';
import { Layout, Typography, Card, Spin, Alert, Button, Space, Tag, message } from 'antd';
import { UserOutlined, ReloadOutlined, LogoutOutlined, DashboardOutlined } from '@ant-design/icons';
import { useSecurity } from '../../contexts/SecurityContext';
import { unifiedAPI, shopAPI } from '../../services/api';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const AdminDashboard = () => {
  const { user, logout, timeRemaining, refreshSession } = useSecurity();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Test function to check if component renders
  console.log('✅ AdminDashboard component is rendering');

  useEffect(() => {
    console.log('🔄 AdminDashboard mounted - fetching data...');
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📊 Fetching dashboard data...');

      // Try to fetch shops
      const shops = await shopAPI.getAll();
      console.log('✅ Shops fetched:', shops?.length || 0);

      // Try to fetch transactions
      const transactions = await unifiedAPI.getCombinedTransactions();
      console.log('✅ Transactions fetched:', transactions?.transactions?.length || 0);

      setData({
        shops: shops || [],
        transactions: transactions || {},
        timestamp: new Date().toISOString()
      });

      message.success('Dashboard data loaded successfully');
    } catch (err) {
      console.error('❌ Error fetching data:', err);
      setError(err.message || 'Failed to load dashboard data');
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const handleLogout = () => {
    logout('manual');
  };

  const handleRefreshSession = async () => {
    try {
      await refreshSession();
      message.success('Session refreshed');
    } catch (err) {
      message.error('Failed to refresh session');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#0F172A',
        flexDirection: 'column'
      }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)' }}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, background: '#0F172A', minHeight: '100vh' }}>
        <Card 
          title="Dashboard Error"
          style={{ 
            background: '#1E293B', 
            border: '1px solid #2D3748',
            borderRadius: 12,
            maxWidth: 800,
            margin: '0 auto'
          }}
          headStyle={{ color: 'white', borderBottom: '1px solid #2D3748' }}
        >
          <Alert
            type="error"
            message="Error Loading Dashboard"
            description={
              <div>
                <p>{error}</p>
                <p style={{ fontSize: 12, color: '#888' }}>
                  Check the console for more details (F12)
                </p>
              </div>
            }
            showIcon
            action={
              <Button type="primary" onClick={fetchData} loading={loading}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#0F172A' }}>
      <Header style={{ 
        background: '#1E293B', 
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #2D3748'
      }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          <DashboardOutlined style={{ marginRight: 8 }} />
          PAMELA - ADMIN DASHBOARD
        </Title>
        <Space>
          {timeRemaining !== undefined && (
            <Tag 
              color={timeRemaining <= 10 ? 'red' : timeRemaining <= 30 ? 'orange' : 'green'}
            >
              Session: {timeRemaining}s
            </Tag>
          )}
          <Button 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={handleRefresh}
            loading={refreshing}
            size="small"
          >
            Refresh
          </Button>
          <Button 
            onClick={handleRefreshSession}
            size="small"
          >
            Refresh Session
          </Button>
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
      <Content style={{ padding: 24 }}>
        <Card 
          title="Dashboard Overview"
          style={{ 
            background: '#1E293B', 
            border: '1px solid #2D3748',
            borderRadius: 12
          }}
          headStyle={{ color: 'white', borderBottom: '1px solid #2D3748' }}
        >
          <div style={{ color: 'rgba(255,255,255,0.8)' }}>
            <Title level={4} style={{ color: 'white' }}>Welcome back, {user?.name || 'Admin'}!</Title>
            <div style={{ marginTop: 16 }}>
              <Row gutter={[16, 16]}>
                <Col span={6}>
                  <Card size="small" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Shops</Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>
                      {data?.shops?.length || 0}
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Transactions</Text>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>
                      {data?.transactions?.transactions?.length || 0}
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>User</Text>
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>
                      {user?.email || 'Not logged in'}
                    </div>
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Session</Text>
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: 'white' }}>
                      {timeRemaining !== undefined ? `${timeRemaining}s remaining` : 'N/A'}
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
            <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A'}
              </Text>
            </div>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

// Row and Col components for the grid
const Row = ({ children, gutter, style }) => {
  const gutterStyle = gutter ? { padding: `0 ${gutter[1]/2}px` } : {};
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-8px', ...style }}>
      {React.Children.map(children, child => 
        React.cloneElement(child, { style: { padding: '8px', ...(child.props.style || {}) } })
      )}
    </div>
  );
};

const Col = ({ children, span, style }) => {
  const width = span ? `${(span/24) * 100}%` : '100%';
  return (
    <div style={{ width, ...style }}>
      {children}
    </div>
  );
};

export default AdminDashboard;