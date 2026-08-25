// src/contexts/SecurityContext.jsx - SIMPLIFIED (No device verification)
import React, { createContext, useContext, useState, useEffect } from 'react';

const SecurityContext = createContext(null);

export const SecurityProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('authToken') || localStorage.getItem('sessionToken');
    const savedUser = localStorage.getItem('userData');
    
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
        console.log('✅ Session restored for:', parsedUser.email);
      } catch (e) {
        console.error('Error parsing user data:', e);
        localStorage.removeItem('userData');
        localStorage.removeItem('authToken');
        localStorage.removeItem('sessionToken');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, authToken) => {
    console.log('🔐 Logging in:', userData?.email);
    
    // Store user data
    if (userData) {
      localStorage.setItem('userData', JSON.stringify(userData));
      localStorage.setItem('authToken', authToken || '');
      localStorage.setItem('sessionToken', authToken || '');
      
      // Store role-specific data
      if (userData.role === 'admin') {
        localStorage.setItem('adminData', JSON.stringify(userData));
        localStorage.setItem('adminToken', authToken || '');
      } else if (userData.role === 'cashier') {
        localStorage.setItem('cashierData', JSON.stringify(userData));
        localStorage.setItem('cashierToken', authToken || '');
      } else if (userData.role === 'manager') {
        localStorage.setItem('managerData', JSON.stringify(userData));
        localStorage.setItem('managerToken', authToken || '');
      }
    }
    
    setUser(userData);
    setToken(authToken);
  };

  const logout = (reason = 'manual') => {
    console.log(`🔒 Logging out (reason: ${reason})`);
    
    // Clear all storage
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('adminData');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('cashierData');
    localStorage.removeItem('cashierToken');
    localStorage.removeItem('managerData');
    localStorage.removeItem('managerToken');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('deviceVerified');
    
    setUser(null);
    setToken(null);
  };

  const refreshSession = async () => {
    // Simple refresh - just return true since we don't have complex sessions
    console.log('🔄 Session refreshed');
    return true;
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
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
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};

export default SecurityContext;