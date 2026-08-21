// src/pages/Manager/ManagerLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../../contexts/SecurityContext';
import { authAPI } from '../../services/api';
import { Container, Box, Typography, Avatar, Paper, CssBaseline, Alert, Button, CircularProgress, TextField, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Engineering, Visibility, VisibilityOff, Devices } from '@mui/icons-material';

const ManagerLogin = () => {
  const navigate = useNavigate();
  const { login } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const colors = {
    primary: { main: '#8B5CF6', light: '#A78BFA', dark: '#7C3AED', gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' },
    background: { main: '#0F172A', paper: '#334155' }
  };

  const getDeviceInfo = () => {
    // FIXED: Define ua as navigator.userAgent
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    
    return {
      deviceId: localStorage.getItem('deviceId') || 'dev_' + Math.random().toString(36).substr(2, 9),
      deviceName: ua.includes('Windows') ? 'Windows PC' : 
                  ua.includes('Mac') ? 'Mac' : 
                  ua.includes('iPhone') ? 'iPhone' : 
                  ua.includes('Android') ? 'Android Device' : 'Unknown Device',
      deviceType: ua.includes('Mobile') ? 'mobile' : 'desktop',
      os: ua.includes('Windows NT 10.0') ? 'Windows 10' : 
          ua.includes('Mac OS X') ? 'macOS' : 
          ua.includes('iPhone') ? 'iOS' : 
          ua.includes('Android') ? 'Android' : 'Unknown',
      browser: ua.includes('Chrome') ? 'Chrome' : 
               ua.includes('Firefox') ? 'Firefox' : 
               ua.includes('Safari') ? 'Safari' : 'Unknown',
      macAddress: 'MAC_' + Math.random().toString(16).slice(2, 8).toUpperCase(),
      userAgent: ua
    };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!credentials.email || !credentials.password) {
      setError('Please enter both email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const deviceInfoData = getDeviceInfo();
      const deviceCheck = await authAPI.checkDevice({ email: credentials.email, deviceInfo: deviceInfoData });
      if (deviceCheck.requiresVerification) {
        setDeviceInfo(deviceCheck.deviceInfo);
        setShowDeviceDialog(true);
        setLoading(false);
        return;
      }
      const response = await authAPI.managerLogin({ email: credentials.email, password: credentials.password });
      if (response.success) {
        login(response.user, response.token, response.sessionId);
        navigate('/manager/dashboard', { replace: true });
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Fixed the password field IconButton nesting issue
  return (
    <Container component="main" maxWidth="sm" sx={{ 
      background: colors.background.main, 
      minHeight: '100vh', 
      padding: 3, 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center' 
    }}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ width: 70, height: 70, background: colors.primary.gradient, mb: 2 }}>
          {loading ? <CircularProgress size={24} color="inherit" /> : <Engineering sx={{ fontSize: 36 }} />}
        </Avatar>
        <Typography variant="h4" sx={{ 
          mb: 1, 
          fontWeight: 'bold', 
          background: colors.primary.gradient, 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent', 
          textAlign: 'center' 
        }}>
          Manager Login
        </Typography>
        {error && <Alert severity="error" sx={{ width: '100%', mb: 3, borderRadius: 2 }}>{error}</Alert>}
        <Paper elevation={8} sx={{ 
          p: 4, 
          width: '100%', 
          borderRadius: 3, 
          background: `linear-gradient(135deg, ${colors.background.paper} 0%, rgba(51, 65, 85, 0.9) 100%)`, 
          border: `1px solid ${colors.primary.main}33` 
        }}>
          <form onSubmit={handleLogin}>
            <TextField 
              fullWidth 
              required 
              name="email" 
              label="Email Address" 
              type="email" 
              value={credentials.email} 
              onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} 
              disabled={loading} 
              autoComplete="email" 
              autoFocus 
              sx={{ mb: 2 }} 
            />
            <TextField 
              fullWidth 
              required 
              name="password" 
              label="Password" 
              type={showPassword ? 'text' : 'password'} 
              value={credentials.password} 
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} 
              disabled={loading} 
              autoComplete="current-password" 
              InputProps={{ 
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ) 
              }} 
            />
            <Button 
              type="submit" 
              fullWidth 
              variant="contained" 
              size="large" 
              disabled={loading || !credentials.email || !credentials.password} 
              sx={{ 
                mt: 3, 
                py: 1.5, 
                background: colors.primary.gradient, 
                borderRadius: 2, 
                '&:hover': { background: colors.primary.dark } 
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>
        </Paper>
      </Box>
      <Dialog open={showDeviceDialog} onClose={() => setShowDeviceDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Device Verification Required</DialogTitle>
        <DialogContent>
          <Alert severity="warning">A new device is trying to access your account. Please wait for admin approval.</Alert>
          {deviceInfo && <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>Device: {deviceInfo.deviceName}</Paper>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeviceDialog(false)}>Dismiss</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ManagerLogin;