// src/contexts/SecurityContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const SecurityContext = createContext();

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within SecurityProvider');
  }
  return context;
};

export const SecurityProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isSessionExpiring, setIsSessionExpiring] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        // Check for user data in multiple storage keys
        const userData = localStorage.getItem('userData') || 
                        localStorage.getItem('cashierData') || 
                        localStorage.getItem('adminData') ||
                        localStorage.getItem('managerData');
        
        const authToken = localStorage.getItem('authToken') || 
                         localStorage.getItem('sessionToken') ||
                         localStorage.getItem('cashierToken') ||
                         localStorage.getItem('adminToken') ||
                         localStorage.getItem('managerToken');

        if (userData && authToken) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setToken(authToken);
          
          // Set session timer (default 5 minutes)
          setTimeRemaining(300);
          startSessionTimer(300);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // Clear invalid data
        localStorage.removeItem('userData');
        localStorage.removeItem('authToken');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('cashierToken');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('managerToken');
        localStorage.removeItem('cashierData');
        localStorage.removeItem('adminData');
        localStorage.removeItem('managerData');
      }
    };

    checkExistingSession();

    // Listen for session expired events
    const handleSessionExpired = () => {
      console.log('🔄 Session expired - logging out');
      logout('expired');
    };

    window.addEventListener('sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
      if (sessionTimer) {
        clearInterval(sessionTimer);
      }
    };
  }, []);

  // Start session timer
  const startSessionTimer = (duration) => {
    if (sessionTimer) {
      clearInterval(sessionTimer);
    }

    let remaining = duration || 300;

    const timer = setInterval(() => {
      remaining -= 1;
      setTimeRemaining(remaining);

      if (remaining <= 30) {
        setIsSessionExpiring(true);
      }

      if (remaining <= 0) {
        clearInterval(timer);
        logout('expired');
        // Dispatch session expired event
        window.dispatchEvent(new CustomEvent('sessionExpired'));
      }
    }, 1000);

    setSessionTimer(timer);
  };

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const response = await authAPI.refreshSession();
      if (response.success) {
        // Reset timer
        setTimeRemaining(300);
        setIsSessionExpiring(false);
        if (sessionTimer) {
          clearInterval(sessionTimer);
          startSessionTimer(300);
        }
        return { success: true };
      } else {
        throw new Error('Failed to refresh session');
      }
    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      // Try to refresh with stored token
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        try {
          // Attempt to refresh using stored token
          setToken(storedToken);
          setTimeRemaining(300);
          setIsSessionExpiring(false);
          if (sessionTimer) {
            clearInterval(sessionTimer);
            startSessionTimer(300);
          }
          return { success: true };
        } catch (retryError) {
          console.error('❌ Session retry failed:', retryError);
          logout('expired');
          return { success: false, error: 'Session expired' };
        }
      }
      return { success: false, error: 'Session expired' };
    }
  }, [sessionTimer]);

  // Login
  const login = useCallback((userData, authToken, sessionId) => {
    setUser(userData);
    setToken(authToken);
    setSessionId(sessionId);
    
    // Store in localStorage
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.setItem('authToken', authToken);
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
    }
    
    // Store in role-specific key
    if (userData.role === 'cashier') {
      localStorage.setItem('cashierData', JSON.stringify(userData));
      localStorage.setItem('cashierToken', authToken);
    } else if (userData.role === 'admin') {
      localStorage.setItem('adminData', JSON.stringify(userData));
      localStorage.setItem('adminToken', authToken);
    } else if (userData.role === 'manager') {
      localStorage.setItem('managerData', JSON.stringify(userData));
      localStorage.setItem('managerToken', authToken);
    }
    
    // Start session timer (5 minutes)
    setTimeRemaining(300);
    setIsSessionExpiring(false);
    startSessionTimer(300);
    
    console.log('✅ Login successful - Session started');
  }, []);

  // Logout
  const logout = useCallback(async (reason = 'manual') => {
    console.log(`🔒 Logging out (reason: ${reason})`);
    
    if (reason !== 'expired' && token) {
      try {
        await authAPI.logout(token);
      } catch (error) {
        console.warn('Logout API call failed:', error);
      }
    }
    
    // Clear state
    setUser(null);
    setToken(null);
    setSessionId(null);
    setTimeRemaining(null);
    setIsSessionExpiring(false);
    
    if (sessionTimer) {
      clearInterval(sessionTimer);
      setSessionTimer(null);
    }
    
    // Clear localStorage
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('cashierData');
    localStorage.removeItem('cashierToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('managerData');
    localStorage.removeItem('managerToken');
    localStorage.removeItem('deviceId');
    localStorage.removeItem('deviceVerified');
    
    // Clear cache
    if (window.cache) {
      window.cache.clearAll();
    }
    
    console.log('✅ Logout completed');
    
    // Navigate to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, [token, sessionTimer]);

  const value = {
    user,
    token,
    sessionId,
    timeRemaining,
    isSessionExpiring,
    login,
    logout,
    refreshSession,
    isAuthenticated: !!user && !!token
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export default SecurityContext;