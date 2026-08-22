// src/contexts/SecurityContext.jsx - ADD THESE FIXES

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

const SecurityContext = createContext();

// Flag to prevent multiple simultaneous logout attempts
let logoutInProgress = false;

export const SecurityProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [sessionExpired, setSessionExpired] = useState(false);
  const timerRef = useRef(null);
  const logoutRef = useRef(false);

  // ... existing code ...

  const logout = async (reason = 'manual') => {
    // CRITICAL FIX: Prevent multiple simultaneous logout attempts
    if (logoutInProgress || logoutRef.current) {
      console.log('⚠️ Logout already in progress, skipping...');
      return;
    }
    
    logoutInProgress = true;
    logoutRef.current = true;
    
    // Clear timer immediately to prevent further ticks
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      // Only attempt API logout if we have a valid token
      const token = localStorage.getItem('sessionToken') || localStorage.getItem('adminToken');
      if (token) {
        try {
          await authAPI.logout(token);
        } catch (apiError) {
          // If API returns 401, the session is already dead - this is fine
          if (apiError.response?.status === 401) {
            console.log('ℹ️ Session already expired, clearing local state');
          } else {
            console.warn('Logout API error:', apiError);
          }
        }
      }
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      // Always clear local state
      localStorage.removeItem('cashierData');
      localStorage.removeItem('cashierToken');
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('deviceId');
      localStorage.removeItem('userData');
      localStorage.removeItem('userToken');
      localStorage.removeItem('adminData');
      localStorage.removeItem('adminToken');
      
      setUser(null);
      setIsAuthenticated(false);
      setTimeRemaining(0);
      setSessionExpired(true);
      
      logoutInProgress = false;
      logoutRef.current = false;
    }
  };

  const refreshSession = async () => {
    try {
      const response = await authAPI.refreshSession();
      if (response?.success) {
        // Reset timer
        setTimeRemaining(300);
        setSessionExpired(false);
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Session refresh failed:', error);
      // If refresh fails with 401, logout
      if (error.response?.status === 401) {
        logout('session_expired');
      }
      return false;
    }
  };

  // Timer effect - runs every second
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        // When time reaches 0, logout
        if (newTime <= 0) {
          // Clear interval first to prevent multiple calls
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Use setTimeout to avoid state update during render
          setTimeout(() => {
            logout('timeout');
          }, 0);
          return 0;
        }
        
        // Show warning at 30 seconds
        if (newTime === 30) {
          console.log('⏰ Session expiring in 30 seconds');
        }
        
        return newTime;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAuthenticated]);

  return (
    <SecurityContext.Provider value={{
      user,
      isAuthenticated,
      timeRemaining,
      sessionExpired,
      login,
      logout,
      refreshSession
    }}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within SecurityProvider');
  }
  return context;
};