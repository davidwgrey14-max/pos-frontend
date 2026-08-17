// src/pages/Auth/AdminLogin.jsx - Enhanced with device verification
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSecurity } from '../../contexts/SecurityContext';
import { authAPI } from '../../services/api';
import {
  Container,
  Box,
  Avatar,
  Paper,
  CssBaseline,
  Alert,
  IconButton,
  InputAdornment,
  Typography,
  CircularProgress,
  Button,
  TextField,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material';
import {
  AdminPanelSettings,
  Email,
  Security,
  ArrowBack,
  Verified,
  Devices,
  Warning
} from '@mui/icons-material';

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [step, setStep] = useState('email');
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('checking');
  const [formData, setFormData] = useState({
    email: '',
    secureCode: ''
  });

  const colors = {
    primary: {
      main: '#6366F1',
      light: '#818CF8',
      dark: '#4F46E5',
      gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
    },
    admin: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)'
    },
    background: {
      main: '#0F172A',
      light: '#1E293B',
      paper: '#334155'
    }
  };

  // Check device on mount
  useEffect(() => {
    const checkDevice = async () => {
      const storedEmail = localStorage.getItem('loginEmail');
      if (storedEmail) {
        setFormData(prev => ({ ...prev, email: storedEmail }));
        const deviceInfo = getDeviceInfo();
        try {
          const result = await authAPI.checkDevice({ 
            email: storedEmail, 
            deviceInfo 
          });
          if (result.requiresVerification) {
            setDeviceInfo(result.deviceInfo);
            setShowDeviceDialog(true);
            setVerificationStatus('pending');
          }
        } catch (error) {
          console.error('Device check error:', error);
        }
      }
    };
    checkDevice();
  }, []);

  const getDeviceInfo = () => {
    const userAgent = navigator.userAgent;
    return {
      deviceId: localStorage.getItem('deviceId') || generateDeviceId(),
      deviceName: getDeviceName(userAgent),
      deviceType: getDeviceType(userAgent),
      os: getOS(userAgent),
      osVersion: getOSVersion(userAgent),
      browser: getBrowser(userAgent),
      browserVersion: getBrowserVersion(userAgent),
      macAddress: generateMacAddress(),
      userAgent: userAgent,
      ipAddress: 'detected'
    };
  };

  const generateDeviceId = () => {
    const id = 'dev_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', id);
    return id;
  };

  const getDeviceName = (ua) => {
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android Device';
    return 'Unknown Device';
  };

  const getDeviceType = (ua) => {
    if (ua.includes('Mobile')) return 'mobile';
    if (ua.includes('Tablet')) return 'tablet';
    return 'desktop';
  };

  const getOS = (ua) => {
    if (ua.includes('Windows NT 10.0')) return 'Windows 10';
    if (ua.includes('Windows NT 6.1')) return 'Windows 7';
    if (ua.includes('Mac OS X')) return 'macOS';
    if (ua.includes('iPhone')) return 'iOS';
    if (ua.includes('Android')) return 'Android';
    return 'Unknown';
  };

  const getOSVersion = (ua) => {
    const match = ua.match(/Windows NT (\d+\.\d+)/) || 
                  ua.match(/Mac OS X (\d+[._]\d+)/) ||
                  ua.match(/Android (\d+[._]\d+)/);
    return match ? match[1] : 'Unknown';
  };

  const getBrowser = (ua) => {
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    return 'Unknown';
  };

  const getBrowserVersion = (ua) => {
    const match = ua.match(/Chrome\/(\d+)/) ||
                  ua.match(/Firefox\/(\d+)/) ||
                  ua.match(/Version\/(\d+)/);
    return match ? match[1] : 'Unknown';
  };

  const generateMacAddress = () => {
    const chars = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 6; i++) {
      let octet = '';
      for (let j = 0; j < 2; j++) {
        octet += chars[Math.floor(Math.random() * 16)];
      }
      mac += (i > 0 ? ':' : '') + octet;
    }
    return mac;
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      // Store email for device check
      localStorage.setItem('loginEmail', formData.email);
      
      const response = await authAPI.requestSecureCode({
        email: formData.email
      });

      if (response.success) {
        setMessage(`Secure code sent to ${formData.email}`);
        setStep('code');
        
        // Check device status after sending code
        const deviceInfo = getDeviceInfo();
        const deviceCheck = await authAPI.checkDevice({ 
          email: formData.email, 
          deviceInfo 
        });
        
        if (deviceCheck.requiresVerification) {
          setDeviceInfo(deviceCheck.deviceInfo);
          setShowDeviceDialog(true);
          setVerificationStatus('pending');
        }
      } else {
        setError(response.message || 'Failed to send secure code');
      }
    } catch (err) {
      setError(err.message || 'Failed to request secure code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    
    if (!formData.secureCode || formData.secureCode.length !== 6) {
      setError('Please enter the 6-digit secure code');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await authAPI.verifySecureCode({
        email: formData.email,
        code: formData.secureCode
      });

      if (response.success) {
        setMessage('Login successful! Redirecting...');
        
        const userData = response.user || {
          email: formData.email,
          role: 'admin',
          name: 'System Administrator'
        };

        // Store login info
        login(userData, response.token, response.sessionId);
        
        setTimeout(() => {
          navigate('/admin/dashboard', { 
            replace: true,
            state: { loginSuccess: true }
          });
        }, 500);
      } else {
        setError(response.message || 'Invalid secure code');
      }
    } catch (err) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'secureCode') {
      const numericValue = value.replace(/\D/g, '').slice(0, 6);
      setFormData(prev => ({ ...prev, [name]: numericValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (error) setError('');
  };

  const handleBackToEmail = () => {
    setStep('email');
    setFormData(prev => ({ ...prev, secureCode: '' }));
    setError('');
    setMessage('');
  };

  const handleCloseDeviceDialog = () => {
    setShowDeviceDialog(false);
  };

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
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <CssBaseline />
      
      <Box sx={{ width: '100%', maxWidth: '400px' }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 'bold',
              background: colors.admin.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            Admin Portal
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.7) }}>
            {step === 'email' ? 'Enter your email to receive a secure code' : 'Enter the 6-digit code sent to your email'}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {message && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}

        <Paper 
          elevation={8} 
          sx={{ 
            p: 4, 
            borderRadius: 3,
            background: `linear-gradient(135deg, ${colors.background.paper} 0%, ${alpha(colors.background.paper, 0.8)} 100%)`,
            border: `1px solid ${alpha(colors.admin.main, 0.2)}`,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Avatar 
              sx={{ 
                width: 70, 
                height: 70, 
                mx: 'auto',
                background: colors.admin.gradient
              }}
            >
              {loading ? <CircularProgress size={40} color="inherit" /> : <AdminPanelSettings />}
            </Avatar>
          </Box>

          {step === 'email' && (
            <form onSubmit={handleRequestCode}>
              <TextField
                fullWidth
                required
                name="email"
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                autoComplete="email"
                autoFocus
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: alpha('#fff', 0.3) },
                    '&:hover fieldset': { borderColor: colors.admin.light },
                    '&.Mui-focused fieldset': { borderColor: colors.admin.main },
                  },
                  '& .MuiInputLabel-root': {
                    color: alpha('#fff', 0.7),
                    '&.Mui-focused': { color: colors.admin.light },
                  },
                }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading || !formData.email}
                sx={{ 
                  py: 1.5, 
                  borderRadius: 2,
                  background: colors.admin.gradient,
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  '&:hover': {
                    background: colors.admin.dark,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 25px ${alpha(colors.admin.main, 0.4)}`,
                  },
                  '&:disabled': {
                    background: alpha(colors.admin.main, 0.5),
                  },
                  transition: 'all 0.3s ease'
                }}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Email />}
              >
                {loading ? 'SENDING...' : 'SEND SECURE CODE'}
              </Button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerifyCode}>
              <TextField
                fullWidth
                required
                name="secureCode"
                label="6-Digit Secure Code"
                type="text"
                value={formData.secureCode}
                onChange={handleChange}
                disabled={loading}
                autoComplete="one-time-code"
                autoFocus
                inputProps={{
                  maxLength: 6,
                  pattern: '[0-9]*',
                  inputMode: 'numeric'
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: alpha('#fff', 0.3) },
                    '&:hover fieldset': { borderColor: colors.admin.light },
                    '&.Mui-focused fieldset': { borderColor: colors.admin.main },
                  },
                  '& .MuiInputLabel-root': {
                    color: alpha('#fff', 0.7),
                    '&.Mui-focused': { color: colors.admin.light },
                  },
                }}
              />
              
              <Typography 
                variant="caption" 
                sx={{ 
                  display: 'block',
                  textAlign: 'center',
                  color: alpha('#fff', 0.6),
                  mb: 3
                }}
              >
                Enter the 6-digit code sent to {formData.email}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="button"
                  variant="outlined"
                  size="large"
                  disabled={loading}
                  onClick={handleBackToEmail}
                  sx={{ 
                    flex: 1,
                    py: 1.5,
                    borderRadius: 2,
                    borderColor: alpha('#fff', 0.3),
                    color: 'white',
                    '&:hover': {
                      borderColor: colors.admin.light,
                      backgroundColor: alpha(colors.admin.light, 0.1),
                    },
                  }}
                  startIcon={<ArrowBack />}
                >
                  BACK
                </Button>
                
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || formData.secureCode.length !== 6}
                  sx={{ 
                    flex: 2,
                    py: 1.5,
                    borderRadius: 2,
                    background: colors.admin.gradient,
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    '&:hover': {
                      background: colors.admin.dark,
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 25px ${alpha(colors.admin.main, 0.4)}`,
                    },
                    '&:disabled': {
                      background: alpha(colors.admin.main, 0.5),
                    },
                    transition: 'all 0.3s ease'
                  }}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Security />}
                >
                  {loading ? 'VERIFYING...' : 'VERIFY'}
                </Button>
              </Box>
            </form>
          )}
        </Paper>

        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 2, color: alpha('#fff', 0.4) }}>
          Secure access for authorized administrators only
        </Typography>
      </Box>

      {/* Device Verification Dialog */}
      <Dialog
        open={showDeviceDialog}
        onClose={handleCloseDeviceDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Devices color="warning" />
          Device Verification Required
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              A new device is trying to access your account. Please wait for admin approval.
            </Alert>
            
            {deviceInfo && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>Device Details:</Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Device:</strong> {deviceInfo.deviceName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>OS:</strong> {deviceInfo.os} {deviceInfo.osVersion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Browser:</strong> {deviceInfo.browser} {deviceInfo.browserVersion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>MAC:</strong> {deviceInfo.macAddress}
                </Typography>
              </Paper>
            )}
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                An email has been sent to administrators. Please wait for approval or try again later.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeviceDialog} color="primary">
            Dismiss
          </Button>
          <Button 
            onClick={() => {
              setShowDeviceDialog(false);
              setStep('email');
            }}
            color="primary"
            variant="contained"
          >
            Try Again
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminLogin;