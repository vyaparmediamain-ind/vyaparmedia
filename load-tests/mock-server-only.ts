import Module from "node:module";
const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: unknown, path: string) {
  if (path === "server-only") return {};
  return originalRequire.call(this, path);
};

