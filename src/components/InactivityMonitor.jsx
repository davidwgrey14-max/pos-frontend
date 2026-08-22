// src/components/InactivityMonitor.jsx - UPDATED

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurity } from '../contexts/SecurityContext'; // Import SecurityContext
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Box,
  Alert,
  IconButton
} from '@mui/material';
import { Close, AccessTime } from '@mui/icons-material';
import { authAPI } from '../services/api';

const InactivityMonitor = ({ children, timeout = 5 }) => {
  const navigate = useNavigate();
  const { refreshSession, logout, timeRemaining } = useSecurity(); // Get from context
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [timer, setTimer] = useState(null);
  const [warningTimer, setWarningTimer] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const activityRef = useRef(true);
  
  const INACTIVITY_LIMIT = timeout * 60 * 1000;
  const WARNING_TIME = 30000;

  const resetTimers = () => {
    if (timer) clearTimeout(timer);
    if (warningTimer) clearTimeout(warningTimer);
    setWarning(false);
    setCountdown(30);
    activityRef.current = true;
  };

  const handleLogout = async (reason = 'inactivity') => {
    // PREVENT MULTIPLE LOGOUT ATTEMPTS
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    
    try {
      // Use the context logout instead of calling API directly
      await logout(reason);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      resetTimers();
      setIsLoggingOut(false);
      
      // Navigate to login
      navigate('/admin-login', { 
        replace: true,
        state: { 
          autoLogout: true,
          message: `You were logged out due to ${reason}.`
        }
      });
    }
  };

  const startInactivityTimer = () => {
    resetTimers();
    
    const timerId = setTimeout(() => {
      setWarning(true);
      setCountdown(30);
      activityRef.current = false;
      
      const warningId = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(warningId);
            handleLogout('inactivity');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setWarningTimer(warningId);
    }, INACTIVITY_LIMIT - WARNING_TIME);
    
    setTimer(timerId);
  };

  useEffect(() => {
    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 
      'touchstart', 'click', 'keydown', 'wheel'
    ];
    
    const handleActivity = () => {
      activityRef.current = true;
      
      if (warning) {
        setWarning(false);
        clearInterval(warningTimer);
        startInactivityTimer();
      } else {
        resetTimers();
        startInactivityTimer();
      }
    };
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });
    
    startInactivityTimer();
    
    // REMOVE the old refresh interval - let SecurityContext handle it
    // Instead, listen to timeRemaining and refresh when low
    let refreshCheck = null;
    
    // Check timeRemaining and refresh if needed
    refreshCheck = setInterval(() => {
      // Use the context's timeRemaining
      if (timeRemaining !== undefined && timeRemaining < 60) {
        // Less than 60 seconds remaining - refresh
        refreshSession().catch(() => {
          // Don't logout here - let SecurityContext handle it
          console.warn('Session refresh failed, will be handled by SecurityContext');
        });
      }
    }, 10000); // Check every 10 seconds
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      resetTimers();
      clearInterval(refreshCheck);
    };
  }, [timeRemaining]); // Add timeRemaining as dependency

  const handleStayActive = () => {
    setWarning(false);
    clearInterval(warningTimer);
    activityRef.current = true;
    
    // Reset timers and refresh session
    refreshSession().then(() => {
      startInactivityTimer();
    }).catch(() => {
      // If refresh fails, logout
      handleLogout('refresh_failed');
    });
  };

  return (
    <>
      {children}
      
      <Dialog
        open={warning}
        onClose={handleStayActive}
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
          background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          py: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccessTime />
            <Typography variant="h6" fontWeight="bold">Session Expiring Soon</Typography>
          </Box>
          <IconButton onClick={() => handleLogout('manual')} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ py: 3 }}>
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2, 
              borderRadius: 2,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              '& .MuiAlert-icon': { color: '#F59E0B' }
            }}
          >
            Your session will expire in <strong>{countdown} seconds</strong> due to inactivity.
          </Alert>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }} gutterBottom>
              Session timeout: {timeout} minutes
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(countdown / 30) * 100}
              color="warning"
              sx={{ 
                height: 8, 
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4
                }
              }}
            />
          </Box>
          
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'rgba(255,255,255,0.5)' }}>
            Click "Stay Active" to continue your session
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0, gap: 1 }}>
          <Button 
            onClick={() => handleLogout('manual')} 
            color="error"
            variant="outlined"
            sx={{
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              '&:hover': {
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)'
              }
            }}
          >
            Logout Now
          </Button>
          <Button 
            onClick={handleStayActive} 
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
              },
              transition: 'all 0.3s ease',
              textTransform: 'none',
              fontWeight: 'bold',
              px: 3
            }}
          >
            Stay Active
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InactivityMonitor;