const Module = require('node:module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(path) {
  if (path === 'server-only') {
    return {};
  }
  return originalRequire.apply(this, arguments);
};
