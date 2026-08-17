// src/components/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSecurity } from '../contexts/SecurityContext';
import { Box, CircularProgress, Typography } from '@mui/material';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, user, checkDeviceVerification, pendingVerification } = useSecurity();
  const location = useLocation();
  const [checkingDevice, setCheckingDevice] = useState(true);
  const [deviceVerified, setDeviceVerified] = useState(false);

  useEffect(() => {
    const verifyDevice = async () => {
      if (isAuthenticated && user) {
        try {
          const deviceInfo = getDeviceInfo();
          const result = await checkDeviceVerification(user.email, deviceInfo);
          setDeviceVerified(result.success);
        } catch (error) {
          console.error('Device verification error:', error);
          setDeviceVerified(false);
        } finally {
          setCheckingDevice(false);
        }
      } else {
        setCheckingDevice(false);
      }
    };

    verifyDevice();
  }, [isAuthenticated, user, checkDeviceVerification]);

  const getDeviceInfo = () => ({
    deviceId: localStorage.getItem('deviceId') || 'unknown',
    deviceName: navigator.userAgent,
    deviceType: 'desktop',
    os: navigator.platform,
    browser: navigator.userAgent,
    userAgent: navigator.userAgent
  });

  if (checkingDevice) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        bgcolor: '#0F172A'
      }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
        <Typography sx={{ mt: 2, color: 'white' }}>
          Verifying device...
        </Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/cashier/shops" replace />;
  }

  if (!deviceVerified && pendingVerification) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        bgcolor: '#0F172A',
        p: 3
      }}>
        <Typography variant="h5" sx={{ color: 'white', mb: 2 }}>
          Device Verification Required
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 500 }}>
          {pendingVerification.message || 'Please wait for admin approval to access this device.'}
        </Typography>
        <Box sx={{ mt: 3, p: 3, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, maxWidth: 500 }}>
          <Typography variant="body2" color="rgba(255,255,255,0.6)">
            Device: {pendingVerification.deviceInfo?.deviceName || 'Unknown'}
          </Typography>
          <Typography variant="body2" color="rgba(255,255,255,0.6)">
            OS: {pendingVerification.deviceInfo?.os || 'Unknown'}
          </Typography>
          <Typography variant="body2" color="rgba(255,255,255,0.6)">
            Browser: {pendingVerification.deviceInfo?.browser || 'Unknown'}
          </Typography>
        </Box>
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute;