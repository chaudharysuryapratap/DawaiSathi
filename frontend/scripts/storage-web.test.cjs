const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function transpile(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function loadErrorMessage() {
  const sourcePath = path.resolve("src", "utils", "error-message.ts");
  const module = { exports: {} };
  vm.runInNewContext(transpile(sourcePath), { module, exports: module.exports }, { filename: sourcePath });
  return module.exports;
}

function loadStorageBase() {
  const sourcePath = path.resolve("src", "utils", "storage", "storage-base.ts");
  const module = { exports: {} };
  vm.runInNewContext(
    transpile(sourcePath),
    {
      module,
      exports: module.exports,
      console: { warn() {} },
      require(id) {
        if (id === "../error-message") return loadErrorMessage();
        throw new Error(`Unexpected import: ${id}`);
      },
    },
    { filename: sourcePath },
  );
  return module.exports.StorageBase;
}

const sourcePath = path.resolve("src", "utils", "storage", "index.web.ts");
const compiled = transpile(sourcePath);

function loadStorage(localStorage, browserGlobal = { localStorage }) {
  const module = { exports: {} };
  const StorageBase = loadStorageBase();
  const sandbox = {
    module,
    exports: module.exports,
    globalThis: browserGlobal,
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
  const legacyWebKey = "dawaisathi:authToken";

  assert.equal(await original.secureSet(legacyWebKey, "opaque-session-value"), true);
  assert.equal(browserStorage.values.get(legacyWebKey), JSON.stringify("opaque-session-value"));
  assert.equal(await new Storage().secureGet(legacyWebKey, null), "opaque-session-value");
  assert.equal(await original.secureRemove(legacyWebKey), true);
  assert.equal(await original.secureGet(legacyWebKey, null), null);
});

test("web secure storage round-trips supported values and falls back for malformed data", async () => {
  const browserStorage = createBrowserStorage();
  const Storage = loadStorage(browserStorage);
  const storage = new Storage();

  assert.equal(await storage.secureSet("auth-flag", true), true);
  assert.equal(await storage.secureGet("auth-flag", false), true);
  browserStorage.values.set("malformed", "{");
  assert.equal(await storage.secureGet("malformed", null), null);
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

  const credentialFailure = loadStorage({
    setItem() {
      throw new Error("Storage access token=opaque-secret");
    },
  });
  await assert.rejects(new credentialFailure().secureSet("auth-token", "value"), (error) => {
    assert.match(error.message, /save: Storage access token=\[redacted\]/);
    assert.doesNotMatch(error.message, /opaque-secret/);
    return true;
  });

  const unavailableBrowser = {};
  Object.defineProperty(unavailableBrowser, "localStorage", {
    get() {
      throw new Error("Browser denied storage access");
    },
  });
  const getterFailure = loadStorage(undefined, unavailableBrowser);
  await assert.rejects(new getterFailure().secureGet("auth-token", null), {
    name: "StorageOperationError",
    message: /read: Browser denied storage access/,
  });
});
