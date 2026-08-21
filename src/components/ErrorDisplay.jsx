// src/components/ErrorDisplay.jsx
import React, { useEffect, useState } from 'react';

const ErrorDisplay = () => {
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    // Override console.error to capture errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError.apply(console, args);
      const errorMsg = args.map(arg => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
        return String(arg);
      }).join(' ');
      
      setErrors(prev => [...prev, { message: errorMsg, time: new Date().toLocaleTimeString() }]);
    };

    // Catch unhandled errors
    const handleError = (event) => {
      const errorMsg = event.error?.message || event.message || 'Unknown error';
      setErrors(prev => [...prev, { message: errorMsg, time: new Date().toLocaleTimeString() }]);
      console.log('Caught error:', errorMsg);
      return true;
    };

    // Catch unhandled promise rejections
    const handleRejection = (event) => {
      const errorMsg = event.reason?.message || 'Unhandled Promise Rejection';
      setErrors(prev => [...prev, { message: errorMsg, time: new Date().toLocaleTimeString() }]);
      console.log('Caught rejection:', errorMsg);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Log initial message
    console.log('🔍 ErrorDisplay initialized - watching for errors');

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalConsoleError;
    };
  }, []);

  if (errors.length === 0) {
    return (
      <div style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: '#52c41a',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '12px',
        zIndex: 99999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        ✅ No errors detected
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 999999,
      padding: '20px',
      overflow: 'auto',
      color: 'white',
      fontFamily: 'monospace'
    }}>
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto',
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '8px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h1 style={{ color: '#ff4d4f', margin: 0 }}>
            🚨 Application Error
          </h1>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reload Page
          </button>
        </div>
        
        <div style={{ 
          background: '#2a2a2a', 
          padding: '15px', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <h3 style={{ color: '#ffa39e', marginTop: 0 }}>Error Details:</h3>
          {errors.map((err, index) => (
            <div key={index} style={{
              borderBottom: '1px solid #333',
              padding: '10px 0'
            }}>
              <div style={{ color: '#888', fontSize: '12px' }}>{err.time}</div>
              <div style={{ color: '#ffa39e', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {err.message}
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ 
          background: '#2a2a2a', 
          padding: '15px', 
          borderRadius: '4px'
        }}>
          <h3 style={{ color: '#91d5ff', marginTop: 0 }}>Actions:</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              style={{
                padding: '8px 16px',
                background: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Storage & Reload
            </button>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              style={{
                padding: '8px 16px',
                background: '#722ed1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;