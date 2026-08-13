// src/utils/cryptoHelper.js

// Simple hash fallback if Web Crypto API fails
const simpleHash = (str) => {
  let hash = 0;
  if (str.length === 0) return '0'.repeat(64);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
};

// SHA-256 using Web Crypto API
export const sha256 = async (message) => {
  try {
    // Check if crypto.subtle is available
    if (window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } else {
      // Fallback for older browsers or non-HTTPS
      console.warn('⚠️ Web Crypto API not available, using fallback hash');
      return simpleHash(message);
    }
  } catch (error) {
    console.error('❌ SHA-256 error:', error);
    return simpleHash(message);
  }
};

// Generate device ID
export const generateDeviceId = async (userAgent, platform, screenInfo, language, timezone) => {
  const data = `${userAgent}${platform}${screenInfo}${language}${timezone}`;
  const hash = await sha256(data);
  return hash.substring(0, 32);
};

// Generate MAC-like identifier
export const generateMacAddress = async (userAgent, screenInfo, language, timezone) => {
  const data = `${userAgent}${screenInfo}${language}${timezone}`;
  const hash = await sha256(data);
  return hash.substring(0, 17).toUpperCase().replace(/(.{2})(?=.)/g, '$1:');
};