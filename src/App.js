// src/App.js - REMOVED device verification route
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { SecurityProvider, useSecurity } from './contexts/SecurityContext';
import InactivityMonitor from './components/InactivityMonitor';
import SessionStatus from './components/SessionStatus';
import Home from './pages/Home';
import AdminLogin from './pages/Auth/AdminLogin';
import CashierLogin from './pages/Auth/CashierLogin';
import AdminDashboard from './pages/Admin/AdminDashboard';
import CashierDashboard from './pages/Cashier/CashierDashboard';
import AdminDashboardHome from './pages/Admin/AdminDashboardHome';
import CashierManagement from './pages/Admin/CashierManagement';
import ShopManagement from './pages/Admin/ShopManagement';
import ProductManagement from './pages/Admin/ProductManagement';
import Inventory from './pages/Admin/Inventory';
import ExpenseManagement from './pages/Admin/ExpenseManagement';
import TransactionReports from './pages/Admin/TransactionReports';
import CreditManagement from './pages/Admin/CreditManagement';
// REMOVED: DeviceVerification import
import ShopSelection from './pages/Cashier/ShopSelection';
import Cart from './pages/Cashier/Cart';
import Receipt from './pages/Cashier/Receipt';
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import ManagerDashboardHome from './pages/Manager/ManagerDashboardHome';
import ManagerLogin from './pages/Manager/ManagerLogin';

const ProtectedRoute = ({ children, requireAdmin = false, requireManager = false }) => {
  const { isAuthenticated, user } = useSecurity();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sessionToken') || 
                  localStorage.getItem('authToken') ||
                  localStorage.getItem('cashierToken') || 
                  localStorage.getItem('adminToken') ||
                  localStorage.getItem('managerToken');
    const userData = localStorage.getItem('userData') || 
                     localStorage.getItem('cashierData') || 
                     localStorage.getItem('adminData') ||
                     localStorage.getItem('managerData');
    
    if (!token || !userData) {
      setChecking(false);
      return;
    }
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0F172A', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #6366F1', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Verifying session...</p>
        </div>
      </div>
    );
  }

  const token = localStorage.getItem('sessionToken') || 
                localStorage.getItem('authToken') ||
                localStorage.getItem('cashierToken') || 
                localStorage.getItem('adminToken') ||
                localStorage.getItem('managerToken');
  
  if (!token) {
    if (requireManager) {
      return <Navigate to="/manager/login" state={{ from: location }} replace />;
    }
    if (requireAdmin) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/cashier-login" state={{ from: location }} replace />;
  }

  // Check user role from localStorage
  let userRole = null;
  const adminData = localStorage.getItem('adminData') || localStorage.getItem('userData');
  const managerData = localStorage.getItem('managerData') || localStorage.getItem('userData');
  const cashierData = localStorage.getItem('cashierData') || localStorage.getItem('userData');
  
  if (adminData) {
    try {
      const parsed = JSON.parse(adminData);
      userRole = parsed.role;
    } catch (e) {}
  }
  
  if (managerData && !userRole) {
    try {
      const parsed = JSON.parse(managerData);
      userRole = parsed.role;
    } catch (e) {}
  }
  
  if (cashierData && !userRole) {
    try {
      const parsed = JSON.parse(cashierData);
      userRole = parsed.role;
    } catch (e) {}
  }

  // Check if user has the required role
  if (requireAdmin && userRole !== 'admin') {
    console.log('❌ Admin access required but user role is:', userRole);
    return <Navigate to="/cashier/shops" replace />;
  }
  
  if (requireManager && userRole !== 'manager' && userRole !== 'admin') {
    console.log('❌ Manager access required but user role is:', userRole);
    return <Navigate to="/cashier/shops" replace />;
  }

  // REMOVED: Device verification check

  // Get session timeout from user data
  let sessionTimeout = 5; // default 5 minutes
  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    sessionTimeout = userData.sessionTimeout || 5;
  } catch (e) {}

  return (
    <InactivityMonitor timeout={sessionTimeout}>
      {children}
    </InactivityMonitor>
  );
};

const App = () => {
  return (
    <SecurityProvider>
      <BrowserRouter>
        <SessionExpiryListener />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/cashier-login" element={<CashierLogin />} />
          <Route path="/manager-login" element={<ManagerLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/cashier/login" element={<CashierLogin />} />
          <Route path="/manager/login" element={<ManagerLogin />} />
          <Route path="/cashier/shops" element={<ShopSelection />} />
          
          {/* Admin Routes - Protected */}
          <Route path="/admin/*" element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardHome />} />
            <Route path="cashiers" element={<CashierManagement />} />
            <Route path="shops" element={<ShopManagement />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="expenses" element={<ExpenseManagement />} />
            <Route path="transactions" element={<TransactionReports />} />
            <Route path="credits" element={<CreditManagement />} />
            {/* REMOVED: verify-device route */}
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Manager Routes - Protected */}
          <Route path="/manager/*" element={
            <ProtectedRoute requireManager>
              <ManagerDashboard />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ManagerDashboardHome />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="expenses" element={<ExpenseManagement />} />
            <Route path="transactions" element={<TransactionReports />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Cashier Routes - Protected */}
          <Route path="/cashier/dashboard/*" element={
            <ProtectedRoute>
              <CashierDashboard />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="cart" replace />} />
            <Route path="cart" element={<Cart />} />
            <Route path="receipt" element={<Receipt />} />
            <Route path="*" element={<Navigate to="cart" replace />} />
          </Route>

          <Route path="/redirect" element={<SmartRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SecurityProvider>
  );
};

const SessionExpiryListener = () => {
  useEffect(() => {
    const handleSessionExpired = () => {
      message.error('Your session has expired. Please login again.');
      setTimeout(() => {
        window.location.href = '/cashier-login?expired=true';
      }, 500);
    };
    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, []);
  return null;
};

const SmartRedirect = () => {
  const cashierData = localStorage.getItem('cashierData');
  const adminData = localStorage.getItem('adminData');
  const managerData = localStorage.getItem('managerData');
  const token = localStorage.getItem('sessionToken') || 
                localStorage.getItem('authToken') ||
                localStorage.getItem('cashierToken') ||
                localStorage.getItem('adminToken') ||
                localStorage.getItem('managerToken');
  
  if (!token) return <Navigate to="/" replace />;
  
  // Check manager first (highest priority)
  if (managerData) {
    try {
      const parsed = JSON.parse(managerData);
      if (parsed.role === 'manager') {
        return <Navigate to="/manager/dashboard" replace />;
      }
    } catch (e) {}
  }
  
  if (adminData) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  if (cashierData) {
    try {
      const parsedCashier = JSON.parse(cashierData);
      if (parsedCashier.lastShop && parsedCashier.shopName) {
        return <Navigate to="/cashier/dashboard/cart" replace />;
      } else {
        return <Navigate to="/cashier/shops" replace />;
      }
    } catch (e) {
      localStorage.removeItem('cashierData');
      return <Navigate to="/cashier-login" replace />;
    }
  }
  
  return <Navigate to="/" replace />;
};

// Add keyframe animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default App;