// src/pages/Auth/AdminLogin.jsx - Fixed navigation
import React, { useState } from 'react';
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
  Typography,
  CircularProgress,
  Button,
  TextField,
  alpha,
} from '@mui/material';
import {
  AdminPanelSettings,
  Email,
  Security,
  ArrowBack,
} from '@mui/icons-material';

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [step, setStep] = useState('email');
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
      localStorage.setItem('loginEmail', formData.email);
      
      const response = await authAPI.requestSecureCode({
        email: formData.email
      });

      if (response.success) {
        setMessage(`Secure code sent to ${formData.email}`);
        setStep('code');
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

      console.log('Verify response:', response);

      if (response.success) {
        setMessage('Login successful! Redirecting...');
        
        const userData = response.user || {
          email: formData.email,
          role: 'admin',
          name: 'System Administrator'
        };

        // Store login info in context
        login(userData, response.token, response.sessionId);
        
        // Navigate to admin dashboard
        // In AdminLogin.jsx - handleVerifyCode function
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
      console.error('Verify error:', err);
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
    </Container>
  );
};

export default AdminLogin;