
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const DefaultConfig = getDefaultConfig(__dirname);

// Safely add 'cjs' to supported source extensions
DefaultConfig.resolver.sourceExts.push('cjs');

module.exports = DefaultConfig;
