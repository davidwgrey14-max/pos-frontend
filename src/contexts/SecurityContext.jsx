// src/contexts/SecurityContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [sessionTimeout, setSessionTimeout] = useState(60); // 1 minute
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [isSessionExpiring, setIsSessionExpiring] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [deviceVerified, setDeviceVerified] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  
  const inactivityTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isActiveRef = useRef(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('userData');
    const storedToken = localStorage.getItem('authToken');
    const storedDevice = localStorage.getItem('deviceVerified');
    
    if (storedUser && storedToken) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
        setDeviceVerified(storedDevice === 'true');
        startInactivityTimer();
        startSessionTimer();
      } catch (error) {
        console.error('Error loading stored user:', error);
        logout();
      }
    }
  }, []);

  // Activity listeners
  useEffect(() => {
    const handleActivity = () => {
      resetInactivityTimer();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isActiveRef.current = false;
      } else {
        isActiveRef.current = true;
        resetInactivityTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearAllTimers();
    };
  }, []);

  const clearAllTimers = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  };

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // 60 seconds inactivity timeout
    inactivityTimerRef.current = setTimeout(() => {
      if (isActiveRef.current) {
        console.log('⏰ Inactivity timeout - logging out');
        logout('inactivity');
      }
    }, 60000); // 60 seconds
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (isAuthenticated) {
      lastActivityRef.current = Date.now();
      startInactivityTimer();
    }
  }, [isAuthenticated, startInactivityTimer]);

  const startSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
    }
    
    setTimeRemaining(sessionTimeout);
    setIsSessionExpiring(false);
    setShowSessionWarning(false);

    sessionTimerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        // Show warning at 10 seconds
        if (newTime <= 10 && newTime > 0) {
          setIsSessionExpiring(true);
          setShowSessionWarning(true);
        }
        
        // Auto logout at 0
        if (newTime <= 0) {
          clearInterval(sessionTimerRef.current);
          sessionTimerRef.current = null;
          logout('session_expired');
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
  }, [sessionTimeout]);

  const resetSessionTimer = useCallback(() => {
    if (isAuthenticated) {
      setTimeRemaining(sessionTimeout);
      setIsSessionExpiring(false);
      setShowSessionWarning(false);
      startSessionTimer();
    }
  }, [isAuthenticated, sessionTimeout, startSessionTimer]);

  const logout = useCallback(async (reason = 'manual') => {
    try {
      // Call logout API
      if (isAuthenticated) {
        await authAPI.logout();
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear all local storage
      localStorage.removeItem('userData');
      localStorage.removeItem('authToken');
      localStorage.removeItem('cashierData');
      localStorage.removeItem('deviceVerified');
      localStorage.removeItem('sessionId');
      
      clearAllTimers();
      
      setIsAuthenticated(false);
      setUser(null);
      setDeviceVerified(false);
      setShowSessionWarning(false);
      setIsSessionExpiring(false);
      
      // Navigate to login
      navigate('/login', { 
        replace: true,
        state: { 
          logoutReason: reason,
          message: getLogoutMessage(reason)
        }
      });
    }
  }, [isAuthenticated, navigate]);

  const getLogoutMessage = (reason) => {
    switch (reason) {
      case 'inactivity':
        return 'Session ended due to inactivity. Please login again.';
      case 'session_expired':
        return 'Your session has expired. Please login again.';
      case 'device_verification':
        return 'Device verification required. Please login again.';
      case 'manual':
        return 'You have been logged out successfully.';
      default:
        return 'Session ended. Please login again.';
    }
  };

  const refreshSession = useCallback(async () => {
    try {
      const response = await authAPI.refreshSession();
      if (response.success) {
        resetSessionTimer();
        resetInactivityTimer();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Session refresh failed:', error);
      return false;
    }
  }, [resetSessionTimer, resetInactivityTimer]);

  const extendSession = useCallback(() => {
    setTimeRemaining(sessionTimeout);
    setIsSessionExpiring(false);
    setShowSessionWarning(false);
    resetInactivityTimer();
  }, [sessionTimeout, resetInactivityTimer]);

  const login = useCallback((userData, token, sessionId) => {
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.setItem('authToken', token);
    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
    }
    
    setUser(userData);
    setIsAuthenticated(true);
    setDeviceVerified(true);
    localStorage.setItem('deviceVerified', 'true');
    
    startInactivityTimer();
    startSessionTimer();
  }, [startInactivityTimer, startSessionTimer]);

  const requestDeviceVerification = useCallback(async (email) => {
    try {
      const response = await authAPI.requestDeviceVerification({ email });
      if (response.success) {
        setPendingVerification({
          email,
          requestId: response.requestId,
          expiresAt: response.expiresAt
        });
        return { success: true, message: 'Verification request sent to admins' };
      }
      return { success: false, message: response.message || 'Verification request failed' };
    } catch (error) {
      console.error('Device verification request error:', error);
      return { success: false, message: error.message || 'Verification request failed' };
    }
  }, []);

  const checkDeviceVerification = useCallback(async (email, deviceInfo) => {
    try {
      const response = await authAPI.checkDevice({ email, deviceInfo });
      if (response.requiresVerification) {
        setPendingVerification({
          email,
          deviceInfo: response.deviceInfo,
          message: response.message
        });
        return { 
          success: false, 
          requiresVerification: true, 
          message: response.message,
          deviceInfo: response.deviceInfo
        };
      }
      setDeviceVerified(true);
      localStorage.setItem('deviceVerified', 'true');
      return { success: true };
    } catch (error) {
      console.error('Device check error:', error);
      return { success: false, message: error.message };
    }
  }, []);

  const value = {
    isAuthenticated,
    user,
    setUser,
    login,
    logout,
    sessionTimeout,
    timeRemaining,
    isSessionExpiring,
    showSessionWarning,
    deviceVerified,
    pendingVerification,
    setPendingVerification,
    resetInactivityTimer,
    refreshSession,
    extendSession,
    requestDeviceVerification,
    checkDeviceVerification,
    lastActivity: lastActivityRef.current
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
      <SessionWarningDialog />
    </SecurityContext.Provider>
  );
};

// Session Warning Dialog Component
const SessionWarningDialog = () => {
  const { showSessionWarning, timeRemaining, extendSession, logout } = useSecurity();
  
  if (!showSessionWarning) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Session Expiring Soon</h3>
          <p className="text-gray-600 mb-2">
            Your session will expire in <span className="font-bold text-yellow-600">{timeRemaining}</span> seconds.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Click "Stay Logged In" to extend your session.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => logout('manual')}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
            <button
              onClick={extendSession}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityProvider;