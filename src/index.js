// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import ErrorDisplay from './components/ErrorDisplay';

// Create root
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render with error handling
root.render(
  <React.StrictMode>
    <ErrorDisplay />
    <App />
  </React.StrictMode>
);

reportWebVitals();