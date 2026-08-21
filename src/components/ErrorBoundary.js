// src/components/ErrorDisplay.jsx
import React, { useEffect, useState } from 'react';

export const ErrorDisplay = () => {
  const [error, setError] = useState(null);

  useEffect(() => {
    // Catch unhandled errors
    const handleError = (event) => {
      console.error('Caught error:', event.error || event.message);
      setError({
        message: event.error?.message || event.message || 'Unknown error',
        stack: event.error?.stack || ''
      });
    };

    // Catch promise rejections
    const handleRejection = (event) => {
      console.error('Caught rejection:', event.reason);
      setError({
        message: event.reason?.message || 'Promise rejection',
        stack: event.reason?.stack || ''
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (error) {
    return (
      <div style={{
        padding: '20px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        maxWidth: '800px',
        margin: '40px auto',
        fontFamily: 'monospace'
      }}>
        <h2 style={{ color: '#f5222d' }}>🚨 Application Error</h2>
        <div style={{ 
          background: '#f5f5f5', 
          padding: '15px', 
          borderRadius: '4px',
          marginTop: '10px'
        }}>
          <strong>Error Message:</strong>
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-all',
            marginTop: '8px'
          }}>
            {error.message}
          </pre>
        </div>
        {error.stack && (
          <div style={{ 
            background: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            <strong>Stack Trace:</strong>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-all',
              fontSize: '12px',
              marginTop: '8px',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              {error.stack}
            </pre>
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return null;
};

export default ErrorDisplay;