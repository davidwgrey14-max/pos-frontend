// config-overrides.js

const webpack = require('webpack');

module.exports = function override(config) {
  // Add fallbacks for node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    util: require.resolve('util/'),
    process: require.resolve('process/browser'),
    path: require.resolve('path-browserify'),
    os: require.resolve('os-browserify/browser'),
    fs: false,
    net: false,
    tls: false,
    child_process: false,
    http: false,
    https: false,
    zlib: false
  };
  
  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    })
  ];
  
  // Ignore warnings about source maps
  config.ignoreWarnings = [
    /Failed to parse source map/,
    /Critical dependency: the request of a dependency is an expression/
  ];
  
  return config;
};