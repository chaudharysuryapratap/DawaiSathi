const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function transpile(sourcePath) {
  return ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
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
        if (id === "../error-message") {
          return {
            getErrorMessage(error, fallback) {
              return error && typeof error.message === "string" ? error.message : fallback;
            },
          };
        }
        throw new Error(`Unexpected import: ${id}`);
      },
    },
    { filename: sourcePath },
  );
  return module.exports.StorageBase;
}

function loadNativeStorage(secureStore) {
  const sourcePath = path.resolve("src", "utils", "storage", "index.ts");
  const module = { exports: {} };
  const StorageBase = loadStorageBase();
  vm.runInNewContext(
    transpile(sourcePath),
    {
      module,
      exports: module.exports,
      console: { warn() {} },
      require(id) {
        if (id === "./storage-base") return { StorageBase };
        if (id === "@react-native-async-storage/async-storage") {
          return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
        }
        if (id === "expo-secure-store") return { ...secureStore, default: secureStore };
        throw new Error(`Unexpected import: ${id}`);
      },
    },
    { filename: sourcePath },
  );
  return module.exports.Storage;
}

function loadAuthTokenKeys() {
  const sourcePath = path.resolve("src", "auth-token-key.ts");
  const module = { exports: {} };
  vm.runInNewContext(transpile(sourcePath), { module, exports: module.exports }, { filename: sourcePath });
  return module.exports;
}

test("auth token key is valid natively and keeps the existing web key", () => {
  const { AUTH_TOKEN_KEY, LEGACY_WEB_AUTH_TOKEN_KEY, getAuthTokenStorageKey } = loadAuthTokenKeys();
  assert.match(AUTH_TOKEN_KEY, /^[A-Za-z0-9._-]+$/);
  assert.equal(AUTH_TOKEN_KEY, "dawaisathi_authToken");
  assert.equal(LEGACY_WEB_AUTH_TOKEN_KEY, "dawaisathi:authToken");
  assert.equal(getAuthTokenStorageKey("android"), AUTH_TOKEN_KEY);
  assert.equal(getAuthTokenStorageKey("ios"), AUTH_TOKEN_KEY);
  assert.equal(getAuthTokenStorageKey("web"), LEGACY_WEB_AUTH_TOKEN_KEY);
});

test("native secure storage round-trips valid keys and rejects invalid keys before SecureStore", async () => {
  const values = new Map();
  const calls = [];
  const secureStore = {
    async getItemAsync(key) {
      calls.push(["get", key]);
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      calls.push(["set", key]);
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      calls.push(["remove", key]);
      values.delete(key);
    },
  };
  const Storage = loadNativeStorage(secureStore);
  const storage = new Storage();

  for (const key of ["alpha", "app.auth-token_1", "dawaisathi_authToken"]) {
    assert.equal(await storage.secureSet(key, "opaque-session-value"), true);
    assert.equal(await storage.secureGet(key, null), "opaque-session-value");
    assert.equal(await storage.secureRemove(key), true);
    assert.equal(await storage.secureGet(key, null), null);
  }

  const callCount = calls.length;
  for (const key of [
    "",
    "dawaisathi:authToken",
    "white space",
    "token/part",
    "café",
    undefined,
    null,
  ]) {
    await assert.rejects(storage.secureGet(key, null), /Invalid secure storage key/);
    await assert.rejects(storage.secureSet(key, "value"), /Invalid secure storage key/);
    await assert.rejects(storage.secureRemove(key), /Invalid secure storage key/);
  }
  assert.equal(calls.length, callCount);
});
