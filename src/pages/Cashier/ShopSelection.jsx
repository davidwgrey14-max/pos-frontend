// src/pages/Cashier/ShopSelection.jsx - Updated

import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Card,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Avatar,
  Chip,
  Divider,
  Paper,
  alpha,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Store,
  ArrowForward,
  Person,
  Logout,
  PointOfSale,
  CheckCircle,
  Warning,
  Lock,
  LockOpen,
  SwapHoriz
} from '@mui/icons-material';
import { shopAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const ShopSelection = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cashier, setCashier] = useState(null);
  const [selectingShop, setSelectingShop] = useState(null);
  const [assignedShopIds, setAssignedShopIds] = useState([]);

  const colors = {
    primary: {
      main: '#6366F1',
      light: '#818CF8',
      dark: '#4F46E5',
      gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
    },
    cashier: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
      gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'
    },
    background: {
      main: '#0F172A',
      light: '#1E293B',
      paper: '#334155'
    }
  };

  useEffect(() => {
    initializeCashier();
    fetchAssignedShops();
  }, []);

  const initializeCashier = () => {
    try {
      const cashierData = JSON.parse(localStorage.getItem('cashierData'));
      if (!cashierData) {
        navigate('/cashier/login');
        return;
      }
      setCashier(cashierData);
      
      // Check if cashier has assigned shops
      if (cashierData.assignedShops && cashierData.assignedShops.length > 0) {
        const shopIds = cashierData.assignedShops.map(shop => shop.shopId);
        setAssignedShopIds(shopIds);
      }
    } catch (error) {
      console.error('Error initializing cashier:', error);
      navigate('/cashier/login');
    }
  };

  const fetchAssignedShops = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const cashierData = JSON.parse(localStorage.getItem('cashierData'));
      
      // If cashier has assigned shops in localStorage, use those
      if (cashierData?.assignedShops && cashierData.assignedShops.length > 0) {
        const assignedShops = cashierData.assignedShops.map(shop => ({
          _id: shop.shopId,
          name: shop.name,
          location: shop.location || 'Location not specified',
          status: 'active',
          isPrimary: shop.isPrimary || false,
          type: shop.type || 'retail'
        }));
        setShops(assignedShops);
        setLoading(false);
        return;
      }
      
      // Fallback: fetch all shops (legacy mode)
      const response = await shopAPI.getAll();
      let shopsData = [];
      
      if (response && typeof response === 'object') {
        if (Array.isArray(response.data)) {
          shopsData = response.data;
        } else if (Array.isArray(response)) {
          shopsData = response;
        }
      }
      
      const safeShops = shopsData
        .filter(shop => shop && typeof shop === 'object' && shop._id && shop.name)
        .map(shop => ({
          _id: shop._id,
          name: shop.name,
          location: shop.location || 'Location not specified',
          description: shop.description || '',
          status: shop.status || 'active',
          createdAt: shop.createdAt || new Date().toISOString(),
          type: shop.type || 'retail'
        }));
      
      setShops(safeShops);
      
      if (safeShops.length === 0) {
        setError('No shops available. Please contact administrator.');
      }
      
    } catch (error) {
      console.error('Error fetching shops:', error);
      setError('Failed to load shops. Please check your connection and try again.');
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShopSelect = async (shop) => {
    if (!shop || !shop._id) {
      setError('Invalid shop selection');
      return;
    }
    
    setSelectingShop(shop._id);
    
    try {
      const cashierData = JSON.parse(localStorage.getItem('cashierData')) || {};
      
      // Check if shop is assigned to cashier
      const isAssigned = cashierData.assignedShops?.some(s => s.shopId === shop._id);
      
      // Store selected shop in localStorage
      const updatedCashierData = {
        ...cashierData,
        selectedShop: shop._id,
        selectedShopName: shop.name,
        selectedShopLocation: shop.location,
        selectedAt: new Date().toISOString(),
        shopDescription: shop.description,
        sessionStart: new Date().toISOString(),
        hasAssignedAccess: isAssigned || cashierData.role === 'admin'
      };
      
      localStorage.setItem('cashierData', JSON.stringify(updatedCashierData));
      setCashier(updatedCashierData);
      
      setTimeout(() => {
        navigate('/cashier/dashboard', { 
          replace: true,
          state: { 
            shopSelected: true,
            shopName: shop.name,
            shopId: shop._id
          }
        });
      }, 800);
      
    } catch (error) {
      console.error('Error selecting shop:', error);
      setError(error.message || 'Failed to select shop. Please try again.');
    } finally {
      setSelectingShop(null);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('cashierData');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/cashier/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('cashierData');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/cashier/login', { replace: true });
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchAssignedShops();
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        background: colors.background.main
      }}>
        <CircularProgress 
          size={60} 
          sx={{ 
            color: colors.cashier.main,
            mb: 2
          }} 
        />
        <Typography 
          variant="h6" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.8)',
            mb: 1
          }}
        >
          Loading your assigned shops...
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.6)'
          }}
        >
          Please wait while we load your shop information
        </Typography>
      </Box>
    );
  }

  const hasMultipleShops = shops.length > 1;
  const hasSingleShop = shops.length === 1;

  return (
    <Container 
      component="main" 
      maxWidth="md"
      sx={{
        background: colors.background.main,
        minHeight: '100vh',
        padding: 3,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: `1px solid ${alpha(colors.cashier.main, 0.2)}`,
          background: `linear-gradient(135deg, ${colors.background.paper} 0%, ${alpha(colors.background.paper, 0.9)} 100%)`,
          overflow: 'hidden',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Box sx={{ 
          textAlign: 'center', 
          padding: 4,
          background: `linear-gradient(135deg, ${alpha(colors.cashier.main, 0.1)} 0%, ${alpha(colors.cashier.light, 0.1)} 100%)`,
          position: 'relative'
        }}>
          {selectingShop && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: colors.cashier.light
              }}
            >
              <CircularProgress size={16} color="inherit" />
              <Typography variant="caption">
                Selecting...
              </Typography>
            </Box>
          )}
          
          <Avatar 
            sx={{ 
              width: 80, 
              height: 80, 
              margin: '0 auto 16px',
              background: colors.cashier.gradient,
              boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Person sx={{ fontSize: 40 }} />
          </Avatar>
          
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 'bold',
              background: colors.cashier.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1
            }}
          >
            Welcome, {cashier?.name || 'Cashier'}!
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.8)',
              mb: 2
            }}
          >
            {hasMultipleShops 
              ? `Select a shop from your ${shops.length} assigned locations` 
              : hasSingleShop
              ? 'You are assigned to one shop. Click to start.'
              : 'No shops assigned. Please contact administrator.'}
          </Typography>
          
          {cashier?.canAccessMultipleShops && (
            <Chip 
              icon={<SwapHoriz />}
              label="Multiple Shop Access"
              variant="outlined"
              sx={{ 
                color: colors.cashier.light,
                borderColor: alpha(colors.cashier.main, 0.3),
                backgroundColor: alpha(colors.cashier.main, 0.1),
                fontWeight: 'medium'
              }}
            />
          )}
          
          {cashier?.shopCount === 1 && (
            <Chip 
              icon={<LockOpen />}
              label="Single Shop Access"
              variant="outlined"
              sx={{ 
                color: '#F59E0B',
                borderColor: alpha('#F59E0B', 0.3),
                backgroundColor: alpha('#F59E0B', 0.1),
                fontWeight: 'medium'
              }}
            />
          )}
        </Box>

        <Divider sx={{ borderColor: alpha('#fff', 0.1) }} />

        <Box sx={{ padding: 4 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              textAlign: 'center',
              color: 'white',
              mb: 3,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1
            }}
          >
            <Store />
            {hasMultipleShops ? 'Your Assigned Shops' : 'Your Shop'}
            <Chip 
              label={shops.length}
              size="small"
              sx={{ 
                backgroundColor: alpha(colors.cashier.main, 0.2),
                color: colors.cashier.light,
                fontWeight: 'bold'
              }}
            />
          </Typography>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                borderRadius: 2,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'white',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                '& .MuiAlert-icon': {
                  color: '#EF4444'
                }
              }}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={handleRetry}
                  sx={{
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {!error && shops.length === 0 ? (
            <Alert
              severity="warning"
              icon={<Warning />}
              sx={{
                borderRadius: 2,
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: 'white',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                '& .MuiAlert-icon': {
                  color: '#F59E0B'
                }
              }}
            >
              No shops assigned to you. Please contact administrator to assign shops.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {shops.map((shop, index) => {
                const isPrimary = shop.isPrimary || 
                  (cashier?.primaryShop?.shopId === shop._id);
                
                return (
                  <Paper
                    key={shop._id}
                    sx={{
                      padding: 3,
                      borderRadius: 2,
                      cursor: selectingShop ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      border: `1px solid ${isPrimary ? alpha(colors.cashier.main, 0.4) : alpha(colors.cashier.main, 0.2)}`,
                      backgroundColor: selectingShop === shop._id 
                        ? alpha(colors.cashier.main, 0.15)
                        : isPrimary
                        ? alpha(colors.cashier.main, 0.1)
                        : alpha(colors.background.paper, 0.5),
                      opacity: selectingShop && selectingShop !== shop._id ? 0.6 : 1,
                      '&:hover': selectingShop ? {} : {
                        transform: 'translateY(-2px)',
                        border: `1px solid ${colors.cashier.main}`,
                        boxShadow: `0 8px 25px ${alpha(colors.cashier.main, 0.2)}`,
                        backgroundColor: alpha(colors.cashier.main, 0.1)
                      }
                    }}
                    onClick={() => !selectingShop && handleShopSelect(shop)}
                  >
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between' 
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Badge
                          color="primary"
                          badgeContent={isPrimary ? 'Primary' : null}
                          anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'right'
                          }}
                        >
                          <Avatar 
                            sx={{ 
                              background: isPrimary ? colors.cashier.gradient : colors.primary.gradient,
                              width: 50,
                              height: 50,
                              fontWeight: 'bold',
                              fontSize: '1.2rem'
                            }}
                          >
                            {shop.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                        <Box>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              color: 'white',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1
                            }}
                          >
                            {shop.name}
                            {shop.status === 'active' && (
                              <Chip 
                                label="Active"
                                size="small"
                                sx={{ 
                                  backgroundColor: alpha(colors.cashier.main, 0.2),
                                  color: colors.cashier.light,
                                  fontSize: '0.7rem',
                                  height: 20
                                }}
                              />
                            )}
                            {isPrimary && (
                              <Chip 
                                label="Primary"
                                size="small"
                                sx={{ 
                                  backgroundColor: alpha('#F59E0B', 0.2),
                                  color: '#F59E0B',
                                  fontSize: '0.7rem',
                                  height: 20
                                }}
                              />
                            )}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'rgba(255, 255, 255, 0.7)',
                              mb: 0.5
                            }}
                          >
                            📍 {shop.location}
                          </Typography>
                          {shop.type && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'rgba(255, 255, 255, 0.5)',
                                fontStyle: 'italic'
                              }}
                            >
                              🏷️ {shop.type}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      
                      <Button
                        variant="contained"
                        size="medium"
                        disabled={selectingShop !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShopSelect(shop);
                        }}
                        sx={{
                          background: selectingShop === shop._id 
                            ? alpha(colors.cashier.main, 0.3)
                            : isPrimary
                            ? colors.cashier.gradient
                            : colors.primary.gradient,
                          borderRadius: 2,
                          px: 3,
                          fontWeight: 'bold',
                          minWidth: 120,
                          '&:hover': selectingShop ? {} : {
                            background: colors.cashier.dark,
                            transform: 'translateY(-1px)',
                            boxShadow: `0 6px 20px ${alpha(colors.cashier.main, 0.4)}`
                          },
                          '&:disabled': {
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'rgba(255, 255, 255, 0.3)'
                          }
                        }}
                        startIcon={
                          selectingShop === shop._id ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <PointOfSale />
                          )
                        }
                      >
                        {selectingShop === shop._id ? 'Selecting...' : 'Start POS'}
                      </Button>
                    </Box>
                    
                    {selectingShop === shop._id && (
                      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} color="inherit" />
                        <Typography variant="caption" sx={{ color: colors.cashier.light }}>
                          Preparing your POS session...
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: alpha('#fff', 0.1) }} />

        <Box sx={{ 
          padding: 3, 
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          gap: 2
        }}>
          <Button
            variant="outlined"
            size="medium"
            onClick={handleRetry}
            disabled={loading}
            startIcon={<CheckCircle />}
            sx={{
              color: colors.cashier.light,
              borderColor: alpha(colors.cashier.main, 0.5),
              '&:hover': {
                color: 'white',
                borderColor: colors.cashier.light,
                backgroundColor: alpha(colors.cashier.main, 0.1)
              }
            }}
          >
            Refresh
          </Button>
          
          <Button
            variant="outlined"
            size="medium"
            onClick={handleLogout}
            startIcon={<Logout />}
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              '&:hover': {
                color: 'white',
                borderColor: 'white',
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            Logout
          </Button>
        </Box>
      </Card>
    </Container>
  );
};

export default ShopSelection;