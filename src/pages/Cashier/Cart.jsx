// src/pages/Cashier/Cart.jsx - SIMPLIFIED VERSION
import React, { useState, useMemo } from 'react';
import {
  Card, List, Button, InputNumber, Typography, Space,
  Tag, Divider, Popconfirm, Tooltip, Badge,
  Row, Col, Statistic, Input, message
} from 'antd';
import {
  DeleteOutlined, ShoppingCartOutlined,
  ClearOutlined, EditOutlined, CheckOutlined, CloseOutlined,
  ExclamationCircleOutlined, ShopOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const Cart = ({ 
  cart, 
  onUpdateItem, 
  onRemoveItem, 
  onClearCart, 
  onCheckout, 
  onUpdateItemPrice,
  loading, 
  totals = {},
  shop,
  className = ''
}) => {
  const [editingPriceItem, setEditingPriceItem] = useState(null);
  const [tempPrice, setTempPrice] = useState(0);

  const safeTotals = useMemo(() => ({
    subtotal: totals?.subtotal || 0,
    totalItems: totals?.totalItems || 0,
    grandTotal: totals?.grandTotal || totals?.subtotal || 0
  }), [totals]);

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount || 0).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Stock analysis for warnings
  const stockAnalysis = useMemo(() => {
    const outOfStockItems = cart.filter(item => item.stock === 0);
    return {
      outOfStockItems,
      hasOutOfStock: outOfStockItems.length > 0,
      totalOutOfStock: outOfStockItems.length
    };
  }, [cart]);

  // Price editing handlers
  const handleStartEditPrice = (item) => {
    setEditingPriceItem(item.productId);
    setTempPrice(item.price);
  };

  const handleSavePrice = (productId) => {
    if (onUpdateItemPrice && tempPrice > 0) {
      const newPrice = parseFloat(tempPrice);
      onUpdateItemPrice(productId, newPrice);
      message.success(`Price updated to ${formatCurrency(newPrice)}`);
    }
    setEditingPriceItem(null);
    setTempPrice(0);
  };

  const handleCancelEditPrice = () => {
    setEditingPriceItem(null);
    setTempPrice(0);
  };

  // Calculate price difference for display
  const getPriceDifference = (item) => {
    const originalPrice = item.originalPrice || item.buyingPrice || 0;
    return item.price - originalPrice;
  };

  return (
    <Card
      className={`cart-component ${className}`}
      title={
        <Space>
          <ShoppingCartOutlined />
          <span>Shopping Cart</span>
          <Badge 
            count={cart.length} 
            showZero 
            color="#52c41a" 
            style={{ marginLeft: 8 }} 
          />
          {shop && (
            <Tag color="blue" icon={<ShopOutlined />}>
              {shop.name}
            </Tag>
          )}
        </Space>
      }
      extra={
        cart.length > 0 ? (
          <Popconfirm
            title="Clear Entire Cart"
            description="This will remove all items from your cart. Continue?"
            onConfirm={onClearCart}
            okText="Yes, Clear All"
            cancelText="Cancel"
            okType="danger"
          >
            <Button 
              icon={<ClearOutlined />} 
              danger 
              size="small"
              disabled={loading}
            >
              Clear Cart
            </Button>
          </Popconfirm>
        ) : null
      }
      style={{ height: 'fit-content', minHeight: '400px' }}
      bodyStyle={{ padding: cart.length === 0 ? '24px' : '16px' }}
    >
      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <ShoppingCartOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: 16 }} />
          <Title level={4} type="secondary" style={{ marginBottom: 8 }}>
            Your Cart is Empty
          </Title>
          <Text type="secondary">
            Start adding products from the inventory to begin a sale
          </Text>
        </div>
      ) : (
        <>
          {/* Stock Warnings - Only show critical errors */}
          {stockAnalysis.hasOutOfStock && (
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#fff2f0', 
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              marginBottom: 16
            }}>
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                <Text type="danger">
                  {stockAnalysis.totalOutOfStock} item(s) out of stock
                </Text>
              </Space>
            </div>
          )}

          {/* Cart Items - Simplified */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
            <List
              dataSource={cart}
              renderItem={(item, index) => {
                const priceDifference = getPriceDifference(item);
                const isPriceEdited = priceDifference !== 0;
                
                return (
                  <List.Item
                    actions={[
                      <Tooltip title="Adjust price" key="edit">
                        <Button
                          icon={<EditOutlined />}
                          size="small"
                          type={isPriceEdited ? "primary" : "text"}
                          onClick={() => handleStartEditPrice(item)}
                          disabled={loading || item.stock === 0}
                        />
                      </Tooltip>,
                      <Tooltip title="Remove from cart" key="remove">
                        <Button
                          icon={<DeleteOutlined />}
                          size="small"
                          danger
                          type="text"
                          onClick={() => onRemoveItem(item.productId)}
                          disabled={loading}
                        />
                      </Tooltip>
                    ]}
                    style={{
                      opacity: item.stock === 0 ? 0.6 : 1,
                      borderBottom: '1px solid #f0f0f0',
                      padding: '8px 0'
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{ textAlign: 'center', minWidth: 30 }}>
                          <Text strong style={{ color: item.stock === 0 ? '#ff4d4f' : '#52c41a' }}>
                            {index + 1}
                          </Text>
                        </div>
                      }
                      title={
                        <Space>
                          <Text 
                            strong 
                            style={{ 
                              color: item.stock === 0 ? '#ff4d4f' : 'inherit',
                              maxWidth: '150px'
                            }}
                          >
                            {item.name}
                          </Text>
                          {item.stock === 0 && (
                            <Tag color="red" style={{ fontSize: '10px', margin: 0 }}>
                              OUT OF STOCK
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          {/* Price Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            {editingPriceItem === item.productId ? (
                              <Space.Compact style={{ width: '100%' }}>
                                <InputNumber
                                  value={tempPrice}
                                  onChange={setTempPrice}
                                  min={0}
                                  step={1}
                                  precision={2}
                                  size="small"
                                  style={{ width: '120px' }}
                                  formatter={value => `KES ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  parser={value => value.replace(/KES\s?|(,*)/g, '')}
                                  autoFocus
                                />
                                <Button 
                                  type="primary" 
                                  size="small" 
                                  icon={<CheckOutlined />}
                                  onClick={() => handleSavePrice(item.productId)}
                                  disabled={!tempPrice || tempPrice <= 0}
                                />
                                <Button 
                                  size="small" 
                                  icon={<CloseOutlined />}
                                  onClick={handleCancelEditPrice}
                                />
                              </Space.Compact>
                            ) : (
                              <Space>
                                <Text 
                                  strong 
                                  style={{ 
                                    color: isPriceEdited ? '#cf1322' : '#1890ff',
                                    fontSize: '14px'
                                  }}
                                >
                                  {formatCurrency(item.price)} each
                                </Text>
                                {isPriceEdited && (
                                  <Tag 
                                    color={priceDifference > 0 ? 'red' : 'green'} 
                                    style={{ fontSize: '10px', margin: 0 }}
                                  >
                                    {priceDifference > 0 ? '↑' : '↓'} {formatCurrency(Math.abs(priceDifference))}
                                  </Tag>
                                )}
                              </Space>
                            )}
                            <Text strong style={{ fontSize: '14px', color: '#1890ff' }}>
                              {formatCurrency(item.price * item.quantity)}
                            </Text>
                          </div>

                          {/* Quantity & Stock Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Space>
                              <InputNumber
                                size="small"
                                min={1}
                                max={Math.min(item.stock, 999)}
                                value={item.quantity}
                                onChange={(value) => onUpdateItem(item.productId, value)}
                                style={{ width: '60px' }}
                                disabled={loading || item.stock === 0}
                              />
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                × {item.quantity} units
                              </Text>
                            </Space>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              Stock: {item.stock}
                            </Text>
                          </div>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </div>

          <Divider />

          {/* Simplified Totals */}
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <Text strong>Total Items</Text>
                  <div style={{ fontSize: '18px', color: '#1890ff', marginTop: 4 }}>
                    {safeTotals.totalItems}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <Text strong>Subtotal</Text>
                  <div style={{ fontSize: '18px', color: '#1890ff', marginTop: 4 }}>
                    {formatCurrency(safeTotals.subtotal)}
                  </div>
                </div>
              </Col>
            </Row>

            {/* Grand Total - Simplified */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f0f8ff',
              borderRadius: '6px',
              border: '1px solid #1890ff'
            }}>
              <Text strong style={{ fontSize: '16px' }}>Grand Total</Text>
              <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                {formatCurrency(safeTotals.grandTotal)}
              </Title>
            </div>
          </Space>

          {/* Checkout Button - Simplified */}
          <div style={{ marginTop: '16px' }}>
            <Button
              type="primary"
              size="large"
              loading={loading}
              onClick={() => onCheckout()}
              disabled={
                cart.length === 0 || 
                stockAnalysis.hasOutOfStock || 
                loading ||
                safeTotals.grandTotal <= 0
              }
              style={{ 
                width: '100%', 
                height: '45px', 
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'PROCESSING...' : `COMPLETE SALE - ${formatCurrency(safeTotals.grandTotal)}`}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default Cart;