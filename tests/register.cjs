// Small local test loader; uses the project's TypeScript compiler, no extra runner.
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...args) {
  return resolve.call(
    this,
    name.startsWith("@/")
      ? path.join(__dirname, "../src", name.slice(2))
      : name,
    parent,
    ...args,
  );
};
require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
};
