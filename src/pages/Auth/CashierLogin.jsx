// src/pages/Auth/CashierLogin.jsx - COMPLETE UPDATED VERSION

import React, { useState, useEffect } from 'react';
import { 
  Container,
  Box,
  Typography,
  Avatar,
  Paper,
  CssBaseline,
  Alert,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress
} from '@mui/material';
import { 
  PointOfSale,
  ArrowBack,
  Visibility,
  VisibilityOff,
  Computer,
  PhoneAndroid,
  Laptop,
  Tablet,
  CheckCircle,
  Cancel,
  Pending,
  Security,
  Warning,
  Refresh
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../../services/api';

// ==================== DEVICE FINGERPRINTING ====================

const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const screenInfo = `${window.screen.width}x${window.screen.height}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  
  // Detect OS
  let os = 'Unknown';
  let osVersion = 'Unknown';
  let deviceType = 'unknown';
  let deviceName = 'Unknown Device';
  
  if (userAgent.includes('Windows NT 10.0')) {
    os = 'Windows 10';
    osVersion = '10.0';
    deviceType = 'desktop';
    deviceName = 'Windows PC';
  } else if (userAgent.includes('Windows NT 6.1')) {
    os = 'Windows 7';
    osVersion = '6.1';
    deviceType = 'desktop';
    deviceName = 'Windows PC';
  } else if (userAgent.includes('Windows NT 6.2')) {
    os = 'Windows 8';
    osVersion = '6.2';
    deviceType = 'desktop';
    deviceName = 'Windows PC';
  } else if (userAgent.includes('Windows NT 6.3')) {
    os = 'Windows 8.1';
    osVersion = '6.3';
    deviceType = 'desktop';
    deviceName = 'Windows PC';
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace('_', '.');
    deviceType = 'desktop';
    deviceName = 'Mac';
  } else if (userAgent.includes('iPhone')) {
    os = 'iOS';
    deviceType = 'mobile';
    deviceName = 'iPhone';
  } else if (userAgent.includes('iPad')) {
    os = 'iOS';
    deviceType = 'tablet';
    deviceName = 'iPad';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    deviceType = 'mobile';
    const match = userAgent.match(/Android (\d+[._]\d+)/);
    if (match) osVersion = match[1];
    deviceName = 'Android Device';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
    deviceType = 'desktop';
    deviceName = 'Linux PC';
  }
  
  // Detect Browser
  let browser = 'Unknown';
  let browserVersion = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
    const match = userAgent.match(/Edg\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
    const match = userAgent.match(/Opera\/(\d+)/) || userAgent.match(/OPR\/(\d+)/);
    if (match) browserVersion = match[1];
  }
  
  // Generate device ID (fingerprint)
  const deviceId = require('crypto')
    .createHash('sha256')
    .update(`${userAgent}${platform}${screenInfo}${language}${timezone}`)
    .digest('hex')
    .substring(0, 32);
  
  // Generate MAC-like identifier (fingerprint)
  const macAddress = require('crypto')
    .createHash('sha256')
    .update(`${userAgent}${screenInfo}${language}${timezone}`)
    .digest('hex')
    .substring(0, 17)
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, '$1:');
  
  return {
    userAgent,
    deviceId,
    os,
    osVersion,
    browser,
    browserVersion,
    deviceType,
    deviceName,
    macAddress,
    screenResolution: screenInfo,
    platform,
    timezone,
    language,
    loginTime: new Date().toISOString()
  };
};

const getDeviceIcon = (deviceType) => {
  switch (deviceType) {
    case 'desktop':
      return <Computer />;
    case 'laptop':
      return <Laptop />;
    case 'mobile':
      return <PhoneAndroid />;
    case 'tablet':
      return <Tablet />;
    default:
      return <Computer />;
  }
};

// ==================== MAIN COMPONENT ====================

const CashierLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [timeUntilInactivity, setTimeUntilInactivity] = useState(300);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [isCheckingDevice, setIsCheckingDevice] = useState(false);

  // Check for auto-logout message
  useEffect(() => {
    if (location.state?.autoLogout) {
      setError(location.state.message || 'You were logged out due to inactivity.');
      // Clear the state to prevent showing again
      window.history.replaceState({}, document.title);
    }
  }, [location]);

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

  // Get device info on mount
  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);
    console.log('📱 Device Info:', info);
    
    // Check if device was previously verified
    const storedDeviceId = localStorage.getItem('deviceId');
    if (storedDeviceId && storedDeviceId === info.deviceId) {
      console.log('✅ Device previously verified');
    }
  }, []);

  // Inactivity timer for verification
  useEffect(() => {
    let countdown;
    
    if (verificationRequired) {
      const expiryTime = Date.now() + 5 * 60 * 1000;
      countdown = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
        setTimeUntilInactivity(remaining);
        
        if (remaining <= 60) {
          setInactivityWarning(true);
        }
        
        if (remaining <= 0) {
          clearInterval(countdown);
          setVerificationRequired(false);
          setShowDeviceDialog(false);
          setError('Verification request expired. Please try again.');
        }
      }, 1000);
    }
    
    return () => {
      if (countdown) clearInterval(countdown);
    };
  }, [verificationRequired]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!credentials.email || !credentials.password) {
      setError('Please enter both email and password');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Attempting cashier login...');
      console.log('📧 Email:', credentials.email);
      console.log('📱 Device Info:', deviceInfo);
      
      // STEP 1: Check if device is verified
      setIsCheckingDevice(true);
      const deviceCheck = await authAPI.checkDevice({
        email: credentials.email,
        deviceInfo: deviceInfo
      });
      setIsCheckingDevice(false);
      
      console.log('📱 Device check response:', deviceCheck);
      
      if (deviceCheck.requiresVerification) {
        setVerificationRequired(true);
        setVerificationData(deviceCheck);
        setShowDeviceDialog(true);
        setLoading(false);
        return;
      }
      
      if (!deviceCheck.success) {
        throw new Error(deviceCheck.message || 'Device verification failed');
      }
      
      // STEP 2: Device is verified, proceed with login
      const response = await authAPI.cashierLogin({
        email: credentials.email,
        password: credentials.password
      });
      
      console.log('✅ Login response:', response);
      
      if (response.success) {
        // Store session data with device info
        const authData = {
          _id: response.user._id,
          name: response.user.name,
          email: response.user.email,
          role: response.user.role,
          token: response.token,
          sessionId: response.sessionId || response.user.sessionId,
          device: response.device || deviceInfo,
          sessionTimeout: response.sessionTimeout || 5,
          loginTime: new Date().toISOString(),
          deviceId: deviceInfo.deviceId
        };
        
        localStorage.setItem('cashierData', JSON.stringify(authData));
        localStorage.setItem('cashierToken', response.token);
        localStorage.setItem('sessionToken', response.token);
        localStorage.setItem('deviceId', deviceInfo.deviceId);
        
        console.log('✅ Login successful - Stored data:', authData);
        console.log('👤 Logged in as:', authData.name);
        console.log('🎯 Role:', authData.role);
        console.log('📱 Device:', authData.device.deviceName);
        
        // Navigate to shop selection
        navigate('/cashier/shops', { 
          replace: true,
          state: { 
            loginSuccess: true,
            cashierName: authData.name,
            deviceInfo: deviceInfo
          }
        });
      }
      
    } catch (err) {
      console.error('❌ Login error:', err);
      
      // Handle verification required
      if (err.response?.data?.requiresVerification) {
        setVerificationRequired(true);
        setVerificationData(err.response.data);
        setShowDeviceDialog(true);
        setLoading(false);
        return;
      }
      
      // Handle session expired
      if (err.response?.data?.code === 'SESSION_EXPIRED') {
        setError('Session expired due to inactivity. Please login again.');
        setLoading(false);
        return;
      }
      
      // Network errors
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Cannot connect to server. Please check if backend is running.');
        setLoading(false);
        return;
      }
      
      // Other errors
      setError(err.response?.data?.message || err.message || 'Login failed. Please try again.');
      setLoading(false);
    } finally {
      setLoading(false);
      setIsCheckingDevice(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ 
      ...prev, 
      [name]: value 
    }));
    
    if (error) {
      setError(null);
    }
  };

  const handleBackToMain = () => {
    navigate('/');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleLogin(e);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Render device verification dialog
  const renderVerificationDialog = () => (
    <Dialog
      open={showDeviceDialog}
      onClose={() => {}} // Prevent closing by clicking outside
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 3
        }
      }}
    >
      <DialogTitle sx={{ 
        background: colors.primary.gradient,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 2
      }}>
        <Security />
        <Typography variant="h6" fontWeight="bold">Device Verification Required</Typography>
      </DialogTitle>
      
      <DialogContent sx={{ mt: 2, pt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          This is a new device. Please wait for admin approval.
        </Alert>
        
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
          Device Information:
        </Typography>
        
        <Paper sx={{ 
          p: 2, 
          mb: 3, 
          bgcolor: 'rgba(255,255,255,0.05)',
          borderRadius: 2
        }}>
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.6)' }}>
                {getDeviceIcon(verificationData?.deviceInfo?.deviceType)}
              </ListItemIcon>
              <ListItemText 
                primary={verificationData?.deviceInfo?.deviceName || 'Unknown Device'}
                secondary={`${verificationData?.deviceInfo?.os || 'Unknown OS'} • ${verificationData?.deviceInfo?.browser || 'Unknown Browser'}`}
                primaryTypographyProps={{ color: 'white' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.6)' }}>
                <Security />
              </ListItemIcon>
              <ListItemText 
                primary="MAC Address"
                secondary={verificationData?.deviceInfo?.macAddress || 'Unknown'}
                primaryTypographyProps={{ color: 'rgba(255,255,255,0.7)', variant: 'caption' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)', sx: { fontFamily: 'monospace' } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.6)' }}>
                <Computer />
              </ListItemIcon>
              <ListItemText 
                primary="IP Address"
                secondary={verificationData?.deviceInfo?.ipAddress || 'Unknown'}
                primaryTypographyProps={{ color: 'rgba(255,255,255,0.7)', variant: 'caption' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)', sx: { fontFamily: 'monospace' } }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.6)' }}>
                <Refresh />
              </ListItemIcon>
              <ListItemText 
                primary="Login Time"
                secondary={new Date().toLocaleString()}
                primaryTypographyProps={{ color: 'rgba(255,255,255,0.7)', variant: 'caption' }}
                secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)' }}
              />
            </ListItem>
          </List>
        </Paper>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Verification Status:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip 
              icon={<Pending />}
              label="Pending Approval"
              color="warning"
              size="small"
            />
            <Chip 
              label={`Expires in ${Math.floor(timeUntilInactivity / 60)}:${String(timeUntilInactivity % 60).padStart(2, '0')}`}
              variant="outlined"
              size="small"
              sx={{ 
                borderColor: timeUntilInactivity < 60 ? '#ef4444' : 'rgba(255,255,255,0.3)',
                color: timeUntilInactivity < 60 ? '#ef4444' : 'rgba(255,255,255,0.7)'
              }}
            />
          </Box>
          
          {inactivityWarning && timeUntilInactivity <= 60 && (
            <Box sx={{ mt: 1 }}>
              <Alert severity="error" icon={<Warning />} sx={{ borderRadius: 2 }}>
                Verification request expires in {timeUntilInactivity} seconds!
              </Alert>
            </Box>
          )}
        </Box>
        
        <LinearProgress 
          variant="determinate" 
          value={(timeUntilInactivity / 300) * 100}
          color={timeUntilInactivity < 60 ? 'error' : 'warning'}
          sx={{ 
            height: 8, 
            borderRadius: 4, 
            mb: 2,
            bgcolor: 'rgba(255,255,255,0.1)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4
            }
          }}
        />
        
        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
        
        <Box sx={{ 
          bgcolor: 'rgba(254, 243, 199, 0.1)', 
          p: 2, 
          borderRadius: 2,
          border: '1px solid rgba(254, 243, 199, 0.2)'
        }}>
          <Typography variant="caption" sx={{ color: '#FCD34D' }}>
            <strong>📋 What happens next?</strong><br />
            1. An admin has been notified of this login attempt<br />
            2. The admin will review the device information<br />
            3. You will receive an email when approved<br />
            4. You can then login from this device
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          variant="outlined"
          onClick={() => {
            setShowDeviceDialog(false);
            setVerificationRequired(false);
            setError('Please try again after admin approval.');
          }}
          sx={{
            color: 'rgba(255,255,255,0.7)',
            borderColor: 'rgba(255,255,255,0.2)',
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.4)',
              backgroundColor: 'rgba(255,255,255,0.05)'
            }
          }}
        >
          Close
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            setShowDeviceDialog(false);
            setVerificationRequired(false);
            // Try checking again
            handleLogin(new Event('submit'));
          }}
          sx={{
            background: colors.cashier.gradient,
            '&:hover': {
              background: colors.cashier.dark
            }
          }}
        >
          Check Status
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Container 
      component="main" 
      maxWidth="sm"
      sx={{
        background: colors.background.main,
        minHeight: '100vh',
        padding: 3,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      <CssBaseline />
      
      {/* Back Button */}
      <Box sx={{ 
        mb: 2,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBackToMain}
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white'
            }
          }}
          disabled={loading || isCheckingDevice}
        >
          Back to Main
        </Button>
        
        {deviceInfo && (
          <Chip
            icon={getDeviceIcon(deviceInfo.deviceType)}
            label={deviceInfo.deviceName}
            size="small"
            sx={{ 
              color: 'rgba(255, 255, 255, 0.7)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              '& .MuiChip-icon': { color: 'rgba(255, 255, 255, 0.5)' }
            }}
            variant="outlined"
          />
        )}
      </Box>

      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1
        }}
      >
        {/* Logo/Icon */}
        <Avatar sx={{ 
          width: 70, 
          height: 70,
          background: colors.cashier.gradient,
          mb: 2,
          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)'
        }}>
          {loading || isCheckingDevice ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <PointOfSale sx={{ fontSize: 36 }} />
          )}
        </Avatar>

        {/* Title */}
        <Typography 
          variant="h4" 
          sx={{ 
            mb: 1,
            fontWeight: 'bold',
            background: colors.cashier.gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textAlign: 'center'
          }}
        >
          Cashier Login
        </Typography>

        {/* Subtitle */}
        <Typography 
          variant="body1" 
          sx={{ 
            mb: 3,
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center'
          }}
        >
          Sign in to access your POS system
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error"
            sx={{ 
              width: '100%', 
              mb: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'white',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Login Form */}
        <Paper 
          elevation={8} 
          sx={{ 
            p: 4,
            width: '100%',
            borderRadius: 3,
            background: `linear-gradient(135deg, ${colors.background.paper} 0%, rgba(51, 65, 85, 0.9) 100%)`,
            border: `1px solid rgba(16, 185, 129, 0.2)`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}
        >
          <Box component="form" onSubmit={handleLogin} noValidate>
            {/* Email Field */}
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              name="email"
              label="Email Address"
              type="email"
              value={credentials.email}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              disabled={loading || isCheckingDevice || verificationRequired}
              autoComplete="email"
              autoFocus
              placeholder="Enter your email"
              sx={{ mb: 2 }}
              InputProps={{
                sx: { 
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.cashier.main,
                  }
                }
              }}
              InputLabelProps={{
                sx: {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': {
                    color: colors.cashier.light,
                  }
                }
              }}
            />
            
            {/* Password Field */}
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={credentials.password}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              disabled={loading || isCheckingDevice || verificationRequired}
              autoComplete="current-password"
              placeholder="Enter your password"
              InputProps={{
                sx: { 
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.cashier.main,
                  }
                },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={togglePasswordVisibility}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      disabled={loading || isCheckingDevice || verificationRequired}
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.5)',
                        '&:hover': {
                          color: colors.cashier.light
                        }
                      }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              InputLabelProps={{
                sx: {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': {
                    color: colors.cashier.light,
                  }
                }
              }}
            />

            {/* Login Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || isCheckingDevice || verificationRequired || !credentials.email || !credentials.password}
              sx={{ 
                mt: 3, 
                mb: 2,
                py: 1.5,
                background: colors.cashier.gradient,
                borderRadius: 2,
                fontSize: '1rem',
                fontWeight: 'bold',
                textTransform: 'none',
                '&:hover': {
                  background: colors.cashier.dark,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 8px 25px ${colors.cashier.main}40`
                },
                '&:disabled': {
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.3)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              {loading || isCheckingDevice ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Security Info */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              gap: 2,
              flexWrap: 'wrap',
              mt: 1
            }}>
              <Chip
                icon={<Security fontSize="small" />}
                label="Device Verified"
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  color: 'rgba(255, 255, 255, 0.6)',
                  '& .MuiChip-icon': { color: 'rgba(16, 185, 129, 0.6)' }
                }}
              />
              <Chip
                icon={<Computer fontSize="small" />}
                label={`${deviceInfo?.os || 'Unknown OS'}`}
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.6)',
                  '& .MuiChip-icon': { color: 'rgba(255, 255, 255, 0.4)' }
                }}
              />
              <Chip
                icon={<Refresh fontSize="small" />}
                label="5min timeout"
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.4)',
                  '& .MuiChip-icon': { color: 'rgba(255, 255, 255, 0.3)' }
                }}
              />
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Device Verification Dialog */}
      {renderVerificationDialog()}
    </Container>
  );
};

export default CashierLogin;