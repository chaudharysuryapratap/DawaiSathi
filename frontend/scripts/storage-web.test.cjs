const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const sourcePath = path.resolve("src", "utils", "storage", "index.web.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

class StorageOperationError extends Error {
  constructor(operation, cause) {
    super(`Secure storage could not ${operation}: ${cause.message}`);
    this.name = "StorageOperationError";
  }
}

class StorageBase {
  warn() {}

  failSecureOperation(operation, error) {
    throw new StorageOperationError(operation, error);
  }

  retrieve(raw, fallback) {
    return raw === null ? fallback : JSON.parse(raw);
  }
}

function loadStorage(localStorage) {
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    globalThis: { localStorage },
    require(id) {
      if (id === "./storage-base") return { StorageBase };
      if (id === "@react-native-async-storage/async-storage") {
        return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
      }
      throw new Error(`Unexpected import: ${id}`);
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return module.exports.Storage;
}

function createBrowserStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("secure session storage survives a new storage instance and logout removes it", async () => {
  const browserStorage = createBrowserStorage();
  const Storage = loadStorage(browserStorage);
  const original = new Storage();

  assert.equal(await original.secureSet("auth-token", "opaque-session-value"), true);
  assert.equal(browserStorage.values.get("auth-token"), JSON.stringify("opaque-session-value"));
  assert.equal(await new Storage().secureGet("auth-token", null), "opaque-session-value");
  assert.equal(await original.secureRemove("auth-token"), true);
  assert.equal(await original.secureGet("auth-token", null), null);
});

test("browser storage failures include their diagnostic reason", async () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("Storage access is denied");
    },
    setItem() {
      throw new Error("Storage quota exceeded");
    },
    removeItem() {
      throw new Error("Storage is unavailable");
    },
  };
  const Storage = loadStorage(unavailableStorage);
  const storage = new Storage();

  await assert.rejects(storage.secureGet("auth-token", null), {
    name: "StorageOperationError",
    message: /read: Storage access is denied/,
  });
  await assert.rejects(storage.secureSet("auth-token", "opaque-session-value"), {
    name: "StorageOperationError",
    message: /save: Storage quota exceeded/,
  });
  await assert.rejects(storage.secureRemove("auth-token"), {
    name: "StorageOperationError",
    message: /remove: Storage is unavailable/,
  });
});
