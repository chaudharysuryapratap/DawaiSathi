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

function loadStorageBase(warnings = []) {
  const sourcePath = path.resolve("src", "utils", "storage", "storage-base.ts");
  const module = { exports: {} };
  vm.runInNewContext(
    transpile(sourcePath),
    {
      module,
      exports: module.exports,
      console: { warn(...values) { warnings.push(values.join(" ")); } },
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

function loadNativeStorage(secureStore, warnings = []) {
  const sourcePath = path.resolve("src", "utils", "storage", "index.ts");
  const module = { exports: {} };
  const StorageBase = loadStorageBase(warnings);
  vm.runInNewContext(
    transpile(sourcePath),
    {
      module,
      exports: module.exports,
      console: { warn(...values) { warnings.push(values.join(" ")); } },
      require(id) {
        if (id === "./storage-base") return { StorageBase };
        if (id === "../../auth-token-key") return loadAuthTokenKeys();
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
  const {
    AUTH_TOKEN_KEY,
    LEGACY_WEB_AUTH_TOKEN_KEY,
    NATIVE_AUTH_TOKEN_KEY,
    getPhysicalSecureStorageKey,
  } = loadAuthTokenKeys();
  assert.equal(AUTH_TOKEN_KEY, "dawaisathi:authToken");
  assert.equal(LEGACY_WEB_AUTH_TOKEN_KEY, "dawaisathi:authToken");
  assert.equal(NATIVE_AUTH_TOKEN_KEY, "dawaisathi_authToken");
  assert.match(getPhysicalSecureStorageKey(AUTH_TOKEN_KEY, "native"), /^[A-Za-z0-9._-]+$/);
  assert.equal(getPhysicalSecureStorageKey(AUTH_TOKEN_KEY, "native"), NATIVE_AUTH_TOKEN_KEY);
  assert.equal(getPhysicalSecureStorageKey(AUTH_TOKEN_KEY, "web"), LEGACY_WEB_AUTH_TOKEN_KEY);
  assert.equal(getPhysicalSecureStorageKey("profile-key", "native"), "profile-key");
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

  const { AUTH_TOKEN_KEY, NATIVE_AUTH_TOKEN_KEY } = loadAuthTokenKeys();
  assert.equal(await storage.secureSet(AUTH_TOKEN_KEY, "opaque-session-value"), true);
  assert.equal(await storage.secureGet(AUTH_TOKEN_KEY, null), "opaque-session-value");
  assert.equal(await storage.secureRemove(AUTH_TOKEN_KEY), true);
  assert.deepEqual(calls.slice(-3), [
    ["set", NATIVE_AUTH_TOKEN_KEY],
    ["get", NATIVE_AUTH_TOKEN_KEY],
    ["remove", NATIVE_AUTH_TOKEN_KEY],
  ]);
  assert.equal(await storage.secureSet("profile-key", "preference"), true);
  assert.deepEqual(calls.at(-1), ["set", "profile-key"]);

  const callCount = calls.length;
  for (const key of [
    "",
    "dawaisathi:unrelated",
    "white space",
    "token/part",
    "café",
    "auth-token\n",
    "auth-token\r",
    "auth-token\u2028",
    "auth-token\u2029",
    undefined,
    null,
  ]) {
    await assert.rejects(storage.secureGet(key, null), /Invalid secure storage key/);
    await assert.rejects(storage.secureSet(key, "value"), /Invalid secure storage key/);
    await assert.rejects(storage.secureRemove(key), /Invalid secure storage key/);
  }
  assert.equal(calls.length, callCount);
});

test("SecureStore key-rejection diagnostics contain only operation and safe key metadata", () => {
  const warnings = [];
  const StorageBase = loadStorageBase(warnings);
  class DiagnosticStorage extends StorageBase {
    report(key, error) {
      this.warnSecureStoreKeyRejection("read", key, error);
    }
  }
  const storage = new DiagnosticStorage();

  storage.report(
    "token:secret",
    new Error('Invalid key provided to SecureStore. token="opaque-session-secret"'),
  );
  storage.report("token-key", new Error("Unrelated native failure"));

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /operation=read keyValid=false keyLength=12 invalidCodePoints=U\+003A/);
  assert.doesNotMatch(warnings[0], /token:secret|opaque-session-secret/);
});

test("SecureStore rejections are diagnosed for read, save, and remove without key or value", async () => {
  const warnings = [];
  const calls = [];
  const secureStore = Object.fromEntries(
    ["getItemAsync", "setItemAsync", "deleteItemAsync"].map((method) => [
      method,
      async (key) => {
        calls.push([method, key]);
        throw new Error("Invalid key provided to SecureStore.");
      },
    ]),
  );
  const Storage = loadNativeStorage(secureStore, warnings);
  const storage = new Storage();
  const { AUTH_TOKEN_KEY, NATIVE_AUTH_TOKEN_KEY } = loadAuthTokenKeys();

  await assert.rejects(storage.secureGet(AUTH_TOKEN_KEY, null), /Secure storage could not read/);
  await assert.rejects(storage.secureSet(AUTH_TOKEN_KEY, "opaque-token-value"), /Secure storage could not save/);
  await assert.rejects(storage.secureRemove(AUTH_TOKEN_KEY), /Secure storage could not remove/);

  const diagnostics = warnings.filter((warning) => warning.includes("SecureStore rejected key:"));
  assert.deepEqual(calls, [
    ["getItemAsync", NATIVE_AUTH_TOKEN_KEY],
    ["setItemAsync", NATIVE_AUTH_TOKEN_KEY],
    ["deleteItemAsync", NATIVE_AUTH_TOKEN_KEY],
  ]);
  assert.equal(diagnostics.length, 3);
  for (const operation of ["read", "save", "remove"]) {
    assert.ok(diagnostics.some((warning) => warning.includes(`operation=${operation} keyValid=true`)));
  }
  assert.ok(diagnostics.every((warning) => /keyLength=\d+ invalidCodePoints=none$/.test(warning)));
  assert.doesNotMatch(diagnostics.join(" "), new RegExp(`${NATIVE_AUTH_TOKEN_KEY}|opaque-token-value`));
});
