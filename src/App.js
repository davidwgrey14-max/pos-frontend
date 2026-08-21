// src/App.js - FIXED
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
import DeviceVerification from './pages/Admin/DeviceVerification';
import ShopSelection from './pages/Cashier/ShopSelection';
import Cart from './pages/Cashier/Cart';
import Receipt from './pages/Cashier/Receipt';
import ManagerDashboard from './pages/Manager/ManagerDashboard';

const ProtectedRoute = ({ children, requireAdmin = false, requireManager = false }) => {
  const { isAuthenticated, user, pendingVerification } = useSecurity();
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sessionToken') || 
                  localStorage.getItem('authToken') ||
                  localStorage.getItem('cashierToken') || 
                  localStorage.getItem('adminToken');
    const userData = localStorage.getItem('userData') || 
                     localStorage.getItem('cashierData') || 
                     localStorage.getItem('adminData');
    
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
                localStorage.getItem('adminToken');
  
  if (!token) {
    return <Navigate to="/cashier-login" state={{ from: location }} replace />;
  }

  if (requireAdmin || requireManager) {
    const adminData = localStorage.getItem('adminData') || 
                     localStorage.getItem('userData');
    if (adminData) {
      try {
        const user = JSON.parse(adminData);
        if (requireAdmin && user.role !== 'admin') {
          return <Navigate to="/cashier/shops" replace />;
        }
        if (requireManager && user.role !== 'manager') {
          return <Navigate to="/cashier/shops" replace />;
        }
      } catch (e) {
        return <Navigate to="/cashier-login" replace />;
      }
    } else {
      return <Navigate to="/cashier-login" replace />;
    }
  }

  const isDeviceVerified = localStorage.getItem('deviceVerified') === 'true';
  if (!isDeviceVerified) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0F172A', padding: '20px' }}>
        <div style={{ background: '#1E293B', padding: '40px', borderRadius: '12px', maxWidth: '500px', textAlign: 'center', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <h2 style={{ color: 'white', marginBottom: 8 }}>Device Verification Required</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
            Please wait for admin approval to access this device.
          </p>
          <button onClick={() => {
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('authToken');
            localStorage.removeItem('cashierToken');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('deviceVerified');
            window.location.href = '/cashier-login';
          }} style={{ marginTop: 20, padding: '10px 24px', background: '#EF4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Logout & Try Again
          </button>
        </div>
      </div>
    );
  }

  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const sessionTimeout = userData.sessionTimeout || 5;

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
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/cashier/login" element={<CashierLogin />} />
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
            <Route path="verify-device" element={<DeviceVerification />} />
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
                localStorage.getItem('cashierToken');
  
  if (!token) return <Navigate to="/" replace />;
  
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
  
  if (managerData) {
    return <Navigate to="/manager/dashboard" replace />;
  }
  
  if (adminData) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  
  return <Navigate to="/" replace />;
};

export default App;