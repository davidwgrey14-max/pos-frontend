// src/contexts/SecurityContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

const SecurityContext = createContext();

// Global flag to prevent multiple simultaneous logout attempts
let logoutInProgress = false;

export const SecurityProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes in seconds
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);
  const logoutRef = useRef(false);
  const mountedRef = useRef(true);

  // Check for existing session on mount
  useEffect(() => {
    mountedRef.current = true;
    checkExistingSession();
    
    // Listen for session expired events
    const handleSessionExpired = (event) => {
      console.log('🔒 Session expired event received:', event?.detail);
      if (mountedRef.current) {
        logout('session_expired');
      }
    };
    
    window.addEventListener('sessionExpired', handleSessionExpired);
    
    return () => {
      mountedRef.current = false;
      window.removeEventListener('sessionExpired', handleSessionExpired);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Check if user is already logged in
  const checkExistingSession = () => {
    try {
      const token = localStorage.getItem('sessionToken') || 
                    localStorage.getItem('authToken') ||
                    localStorage.getItem('cashierToken') || 
                    localStorage.getItem('adminToken');
      
      const userData = localStorage.getItem('userData') || 
                      localStorage.getItem('cashierData') || 
                      localStorage.getItem('adminData');
      
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        setTimeRemaining(300);
        setSessionExpired(false);
        console.log('✅ Existing session found for:', parsedUser.email);
      } else {
        console.log('ℹ️ No existing session found');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Error checking session:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ==================== LOGIN FUNCTION ====================
  
  const login = (userData, token, sessionId) => {
    console.log('🔐 Logging in user:', userData?.email);
    
    try {
      // Store user data
      if (userData) {
        const userRole = userData.role || 'user';
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('userToken', token || '');
        localStorage.setItem('sessionToken', token || '');
        localStorage.setItem('authToken', token || '');
        
        // Store role-specific data
        if (userRole === 'admin') {
          localStorage.setItem('adminData', JSON.stringify(userData));
          localStorage.setItem('adminToken', token || '');
        } else if (userRole === 'cashier') {
          localStorage.setItem('cashierData', JSON.stringify(userData));
          localStorage.setItem('cashierToken', token || '');
        } else if (userRole === 'manager') {
          localStorage.setItem('managerData', JSON.stringify(userData));
          localStorage.setItem('managerToken', token || '');
        }
        
        if (sessionId) {
          localStorage.setItem('sessionId', sessionId);
        }
      }
      
      setUser(userData);
      setIsAuthenticated(true);
      setTimeRemaining(300);
      setSessionExpired(false);
      
      // Start the timer
      startTimer();
      
      console.log('✅ Login successful');
      return true;
    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  };

  // ==================== LOGOUT FUNCTION ====================
  
  const logout = async (reason = 'manual') => {
    // CRITICAL: Prevent multiple simultaneous logout attempts
    if (logoutInProgress || logoutRef.current) {
      console.log('⚠️ Logout already in progress, skipping duplicate call');
      return;
    }
    
    if (!mountedRef.current) {
      console.log('⚠️ Component unmounted, skipping logout');
      return;
    }
    
    logoutInProgress = true;
    logoutRef.current = true;
    console.log(`🔒 Starting logout process (reason: ${reason})...`);
    
    // Clear timer immediately to prevent further ticks
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      // Use authAPI.logout which has its own protection
      await authAPI.logout();
      console.log('✅ Logout completed successfully');
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      // Always clear local state
      if (mountedRef.current) {
        setUser(null);
        setIsAuthenticated(false);
        setTimeRemaining(0);
        setSessionExpired(true);
      }
      
      logoutInProgress = false;
      logoutRef.current = false;
    }
  };

  // ==================== SESSION REFRESH ====================
  
  const refreshSession = async () => {
    try {
      const response = await authAPI.refreshSession();
      if (response?.success) {
        // Reset timer
        setTimeRemaining(300);
        setSessionExpired(false);
        console.log('✅ Session refreshed successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('❌ Session refresh failed:', error);
      // If refresh fails with 401, session is expired
      if (error.response?.status === 401) {
        if (mountedRef.current) {
          logout('session_expired');
        }
      }
      return false;
    }
  };

  // ==================== TIMER MANAGEMENT ====================
  
  const startTimer = () => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (!isAuthenticated) return;
    
    timerRef.current = setInterval(() => {
      if (!mountedRef.current) {
        // Component unmounted, clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      
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
            if (mountedRef.current) {
              logout('timeout');
            }
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
  };

  // Start timer when authentication changes
  useEffect(() => {
    if (isAuthenticated && mountedRef.current) {
      startTimer();
    } else if (!isAuthenticated && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAuthenticated]);

  // ==================== CONTEXT VALUE ====================
  
  const value = {
    user,
    isAuthenticated,
    timeRemaining,
    sessionExpired,
    loading,
    login,
    logout,
    refreshSession,
    // Utility methods
    isAdmin: user?.role === 'admin',
    isCashier: user?.role === 'cashier',
    isManager: user?.role === 'manager',
    getUserRole: () => user?.role || null,
    getUserId: () => user?._id || user?.id || null,
    getUserName: () => user?.name || 'User',
    getUserEmail: () => user?.email || '',
    isSessionValid: () => {
      return isAuthenticated && timeRemaining > 0 && !sessionExpired;
    }
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

// ==================== CUSTOM HOOK ====================

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};

export default SecurityContext;