const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// markdown-it requires Node's "punycode"; RN blocks core modules — alias to npm polyfill
const punycodeFile = require.resolve('punycode/punycode.js');
const punycodeDir = path.dirname(punycodeFile);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  punycode: punycodeDir,
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'punycode') {
    return {
      type: 'sourceFile',
      filePath: punycodeFile,
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
