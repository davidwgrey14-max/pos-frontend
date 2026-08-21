// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Enhanced error logging
const originalError = console.error;
console.error = (...args) => {
  originalError.apply(console, args);
  // Log to a visible element for debugging
  const errorDiv = document.getElementById('error-display');
  if (errorDiv) {
    errorDiv.innerHTML += `<div style="color:red;padding:5px;border-bottom:1px solid #ddd;">${args.join(' ')}</div>`;
  }
};

// Create error display element
const errorDisplay = document.createElement('div');
errorDisplay.id = 'error-display';
errorDisplay.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: white;
  z-index: 99999;
  max-height: 200px;
  overflow-y: auto;
  border-bottom: 2px solid red;
  padding: 10px;
  font-size: 12px;
  font-family: monospace;
  display: none;
`;
document.body.prepend(errorDisplay);

// Show errors in the display
window.addEventListener('error', (event) => {
  errorDisplay.style.display = 'block';
  console.error('Global error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  errorDisplay.style.display = 'block';
  console.error('Unhandled rejection:', event.reason);
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();