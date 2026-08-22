// src/pages/Manager/ManagerLogin.jsx - With secure code flow
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../../contexts/SecurityContext';
import { authAPI } from '../../services/api';
import { 
  Container, Box, Typography, Avatar, Paper, CssBaseline, Alert, 
  Button, CircularProgress, TextField, InputAdornment, IconButton,
  Stepper, Step, StepLabel, StepContent, Card, CardContent,
  LinearProgress
} from '@mui/material';
import { Engineering, Email, Security, CheckCircle, Warning } from '@mui/icons-material';

const ManagerLogin = () => {
  const navigate = useNavigate();
  const { login } = useSecurity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [step, setStep] = useState('email'); // 'email' -> 'code' -> 'pending' -> 'success'
  const [email, setEmail] = useState('');
  const [secureCode, setSecureCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [timer, setTimer] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);

  const colors = {
    primary: { 
      main: '#8B5CF6', 
      light: '#A78BFA', 
      dark: '#7C3AED', 
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)' 
    },
    background: { 
      main: '#0F172A', 
      paper: '#334155' 
    }
  };

  // Timer for code expiration
  useEffect(() => {
    if (step === 'code' && expiresIn > 0) {
      const interval = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setError('Code expired. Please request a new one.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimer(interval);
      return () => clearInterval(interval);
    }
  }, [step, expiresIn]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timer]);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await authAPI.managerLogin({ email });
      
      if (result.requiresVerification) {
        setMessage(result.message);
        setExpiresIn(result.expiresIn || 15);
        setStep('code');
        // Auto-focus code input after a short delay
        setTimeout(() => {
          document.getElementById('code-input')?.focus();
        }, 300);
      } else if (result.isDevMode) {
        // Development mode - auto-logged in
        handleLoginSuccess(result);
      } else if (result.success) {
        handleLoginSuccess(result);
      } else {
        setError('Unexpected response from server');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    
    if (!secureCode || secureCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await authAPI.managerLogin({
        email,
        secureCode
      });

      if (result.requiresDeviceVerification) {
        // Device pending approval
        setDeviceInfo(result.deviceInfo);
        setMessage(result.message);
        setStep('pending');
      } else if (result.success) {
        handleLoginSuccess(result);
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (result) => {
    console.log('✅ Login successful:', result.user);
    setStep('success');
    setMessage('Login successful! Redirecting...');
    
    // Call login from security context
    if (result.user && result.token) {
      login(result.user, result.token, result.sessionId);
    }
    
    // Redirect to manager dashboard
    setTimeout(() => {
      navigate('/manager/dashboard', { replace: true });
    }, 1500);
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const result = await authAPI.managerLogin({ email });
      if (result.requiresVerification) {
        setMessage('New code sent to your email');
        setExpiresIn(result.expiresIn || 15);
        setSecureCode('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setMessage(null);
    setSecureCode('');
    setError(null);
    setDeviceInfo(null);
  };

  // Render email step
  const renderEmailStep = () => (
    <form onSubmit={handleRequestCode}>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
        Enter your email address to receive a secure login code.
      </Typography>
      
      <TextField 
        fullWidth 
        required 
        name="email" 
        label="Email Address" 
        type="email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        disabled={loading} 
        autoComplete="email" 
        autoFocus 
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            color: 'white',
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&:hover fieldset': { borderColor: colors.primary.light },
            '&.Mui-focused fieldset': { borderColor: colors.primary.main },
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-focused': { color: colors.primary.light },
          },
        }} 
      />
      
      <Button 
        type="submit" 
        fullWidth 
        variant="contained" 
        size="large" 
        disabled={loading || !email} 
        sx={{ 
          mt: 2, 
          py: 1.5, 
          background: colors.primary.gradient, 
          borderRadius: 2,
          fontSize: '1rem',
          fontWeight: 'bold',
          '&:hover': { 
            background: colors.primary.dark,
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 25px ${colors.primary.main}40`
          },
          '&:disabled': {
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.3)'
          },
          transition: 'all 0.3s ease'
        }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : 'Send Secure Code'}
      </Button>
    </form>
  );

  // Render code verification step
  const renderCodeStep = () => (
    <form onSubmit={handleVerifyCode}>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
        Enter the 6-digit code sent to <strong style={{ color: 'white' }}>{email}</strong>
      </Typography>
      
      <TextField 
        fullWidth 
        required 
        name="code" 
        label="Secure Code" 
        type="text" 
        value={secureCode} 
        onChange={(e) => {
          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
          setSecureCode(value);
          // Auto-submit when 6 digits are entered
          if (value.length === 6) {
            setTimeout(() => {
              document.getElementById('verify-btn')?.click();
            }, 500);
          }
        }}
        disabled={loading} 
        id="code-input"
        placeholder="Enter 6-digit code"
        inputProps={{ 
          maxLength: 6,
          style: { 
            letterSpacing: '8px', 
            fontSize: '24px', 
            textAlign: 'center' 
          }
        }}
        sx={{ 
          mb: 2,
          '& .MuiOutlinedInput-root': {
            color: 'white',
            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
            '&:hover fieldset': { borderColor: colors.primary.light },
            '&.Mui-focused fieldset': { borderColor: colors.primary.main },
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-focused': { color: colors.primary.light },
          },
        }} 
      />
      
      {expiresIn > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={(expiresIn / 15) * 100} 
            sx={{ 
              flex: 1, 
              height: 6, 
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                background: expiresIn < 5 ? '#EF4444' : colors.primary.gradient,
              }
            }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 60 }}>
            {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, '0')}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button 
          id="verify-btn"
          type="submit" 
          variant="contained" 
          size="large" 
          disabled={loading || secureCode.length !== 6} 
          sx={{ 
            flex: 2,
            py: 1.5, 
            background: colors.primary.gradient, 
            borderRadius: 2,
            fontSize: '1rem',
            fontWeight: 'bold',
            '&:hover': { 
              background: colors.primary.dark,
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 25px ${colors.primary.main}40`
            },
            '&:disabled': {
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)'
            },
            transition: 'all 0.3s ease'
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify & Login'}
        </Button>
        
        <Button 
          type="button" 
          variant="outlined" 
          size="large" 
          onClick={handleBackToEmail}
          disabled={loading}
          sx={{ 
            flex: 1,
            py: 1.5, 
            borderRadius: 2,
            borderColor: 'rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)',
            '&:hover': { 
              borderColor: 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.05)'
            }
          }}
        >
          Back
        </Button>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Button 
          type="button" 
          variant="text" 
          onClick={handleResendCode}
          disabled={loading}
          sx={{ 
            color: colors.primary.light,
            '&:hover': { color: colors.primary.main }
          }}
        >
          Resend Code
        </Button>
      </Box>
    </form>
  );

  // Render pending approval step
  const renderPendingStep = () => (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      <Warning sx={{ fontSize: 64, color: '#F59E0B', mb: 2 }} />
      <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
        Device Verification Pending
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
        {message || 'Your device is pending approval from an administrator.'}
      </Typography>
      
      {deviceInfo && (
        <Card sx={{ 
          background: 'rgba(255,255,255,0.05)', 
          mb: 3,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <CardContent>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Device Information
            </Typography>
            <Box sx={{ mt: 1, textAlign: 'left' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                <strong>Device:</strong> {deviceInfo.deviceName || 'Unknown'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                <strong>OS:</strong> {deviceInfo.os || 'Unknown'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                <strong>Browser:</strong> {deviceInfo.browser || 'Unknown'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
      
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3 }}>
        You will receive an email when your device is approved.
      </Typography>
      
      <Button 
        variant="outlined" 
        onClick={handleBackToEmail}
        sx={{ 
          borderColor: 'rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.7)',
          '&:hover': { 
            borderColor: 'rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.05)'
          }
        }}
      >
        Try Again
      </Button>
    </Box>
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
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar sx={{ 
          width: 70, 
          height: 70, 
          background: colors.primary.gradient, 
          mb: 2 
        }}>
          {step === 'success' ? 
            <CheckCircle sx={{ fontSize: 36 }} /> : 
            <Engineering sx={{ fontSize: 36 }} />
          }
        </Avatar>
        
        <Typography variant="h4" sx={{ 
          mb: 1, 
          fontWeight: 'bold', 
          background: colors.primary.gradient, 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent', 
          textAlign: 'center' 
        }}>
          {step === 'email' && 'Manager Login'}
          {step === 'code' && 'Enter Secure Code'}
          {step === 'pending' && 'Device Verification'}
          {step === 'success' && 'Login Successful!'}
        </Typography>
        
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 3, textAlign: 'center' }}>
          {step === 'email' && 'Secure two-step authentication'}
          {step === 'code' && `Code sent to ${email}`}
          {step === 'pending' && 'Waiting for admin approval'}
          {step === 'success' && 'Redirecting to dashboard...'}
        </Typography>
        
        {error && (
          <Alert 
            severity="error" 
            sx={{ width: '100%', mb: 3, borderRadius: 2 }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}
        
        {message && step !== 'success' && (
          <Alert 
            severity={step === 'pending' ? 'warning' : 'info'} 
            sx={{ width: '100%', mb: 3, borderRadius: 2 }}
            onClose={() => setMessage(null)}
          >
            {message}
          </Alert>
        )}
        
        <Paper elevation={8} sx={{ 
          p: 4, 
          width: '100%', 
          borderRadius: 3, 
          background: `linear-gradient(135deg, ${colors.background.paper} 0%, rgba(51, 65, 85, 0.9) 100%)`, 
          border: `1px solid ${colors.primary.main}33` 
        }}>
          {step === 'email' && renderEmailStep()}
          {step === 'code' && renderCodeStep()}
          {step === 'pending' && renderPendingStep()}
          
          {step === 'success' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 64, color: '#10B981', mb: 2 }} />
              <Typography variant="h6" sx={{ color: 'white', mb: 1 }}>
                Welcome back!
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {message}
              </Typography>
              <CircularProgress size={24} sx={{ mt: 3, color: colors.primary.main }} />
            </Box>
          )}
        </Paper>
        
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', mt: 3 }}>
          Secure login with device verification
        </Typography>
      </Box>
    </Container>
  );
};

export default ManagerLogin;