// src/pages/Cashier/CashierLogin.jsx - Without device verification
import React, { useState } from 'react';
import { 
  Container, Box, Typography, Avatar, Paper, CssBaseline, Alert, Button,
  CircularProgress, TextField, InputAdornment, IconButton
} from '@mui/material';
import { PointOfSale, ArrowBack, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../../contexts/SecurityContext';
import { authAPI } from '../../services/api';

const CashierLogin = () => {
  const navigate = useNavigate();
  const { login } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });

  const colors = {
    cashier: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
      gradient: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'
    },
    background: {
      main: '#0F172A',
      paper: '#334155'
    }
  };

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
      const response = await authAPI.cashierLogin({
        email: credentials.email,
        password: credentials.password
      });

      if (response.success) {
        const userData = response.user || {
          email: credentials.email,
          role: 'cashier',
          name: 'Cashier'
        };

        login(userData, response.token, response.sessionId);
        
        navigate('/cashier/shops', { 
          replace: true,
          state: { loginSuccess: true }
        });
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleBackToMain = () => navigate('/');
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

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
      
      <Box sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBackToMain}
          sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          disabled={loading}
        >
          Back to Main
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        <Avatar sx={{ 
          width: 70, height: 70,
          background: colors.cashier.gradient,
          mb: 2,
          boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)'
        }}>
          {loading ? <CircularProgress size={24} color="inherit" /> : <PointOfSale sx={{ fontSize: 36 }} />}
        </Avatar>

        <Typography variant="h4" sx={{ 
          mb: 1,
          fontWeight: 'bold',
          background: colors.cashier.gradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textAlign: 'center'
        }}>
          Cashier Login
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper elevation={8} sx={{ 
          p: 4, width: '100%', borderRadius: 3,
          background: `linear-gradient(135deg, ${colors.background.paper} 0%, rgba(51, 65, 85, 0.9) 100%)`,
          border: `1px solid rgba(16, 185, 129, 0.2)`
        }}>
          <form onSubmit={handleLogin}>
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
              disabled={loading}
              autoComplete="email"
              autoFocus
              sx={{ mb: 2 }}
              InputProps={{
                sx: { 
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(16, 185, 129, 0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.cashier.main }
                }
              }}
              InputLabelProps={{
                sx: {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': { color: colors.cashier.light }
                }
              }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={credentials.password}
              onChange={handleChange}
              disabled={loading}
              autoComplete="current-password"
              InputProps={{
                sx: { 
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(16, 185, 129, 0.5)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.cashier.main }
                },
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={togglePasswordVisibility}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                      disabled={loading}
                      sx={{ color: 'rgba(255, 255, 255, 0.5)' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              InputLabelProps={{
                sx: {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': { color: colors.cashier.light }
                }
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || !credentials.email || !credentials.password}
              sx={{ 
                mt: 3, mb: 2,
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default CashierLogin;