const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function transpile(sourcePath, jsx = ts.JsxEmit.Preserve) {
  return ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx,
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

function loadStorage(platform, secureStore, localStorage) {
  const sourcePath = path.resolve(
    "src",
    "utils",
    "storage",
    platform === "web" ? "index.web.ts" : "index.ts",
  );
  const module = { exports: {} };
  const StorageBase = loadStorageBase();
  const sandbox = {
    module,
    exports: module.exports,
    globalThis: { localStorage },
    console: { warn() {} },
    require(id) {
      if (id === "./storage-base") return { StorageBase };
      if (id === "@react-native-async-storage/async-storage") {
        return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
      }
      if (id === "expo-secure-store") return { ...secureStore, default: secureStore };
      throw new Error(`Unexpected storage import: ${id}`);
    },
  };
  vm.runInNewContext(transpile(sourcePath), sandbox, { filename: sourcePath });
  return module.exports.Storage;
}

function mountAuthProvider(platform, secureStore, localStorage) {
  const sourcePath = path.resolve("src", "auth-context.tsx");
  const module = { exports: {} };
  const states = [];
  let stateCursor = 0;
  let restoreEffect;
  let authValue;
  let accessToken = null;
  const account = { id: "account-1", name: "Test Account", email: "test@example.com" };
  const storage = new (loadStorage(platform, secureStore, localStorage))();
  const context = { Provider: "AuthProvider" };
  const react = {
    createContext: () => context,
    createElement: (type, props) => {
      authValue = props.value;
      return { type, props };
    },
    useCallback: (callback) => callback,
    useContext: () => authValue,
    useEffect: (effect) => {
      restoreEffect = effect;
    },
    useMemo: (factory) => factory(),
    useState: (initial) => {
      const index = stateCursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      }];
    },
  };
  const api = {
    currentAccount: async () => account,
    login: async () => ({ access_token: "opaque-session-token", user: account }),
    register: async () => ({ access_token: "opaque-session-token", user: account }),
  };
  const errorMessage = {
    getErrorMessage(error, fallback) {
      return error && typeof error.message === "string" ? error.message : fallback;
    },
  };
  vm.runInNewContext(
    transpile(sourcePath, ts.JsxEmit.React),
    {
      module,
      exports: module.exports,
      React: react,
      require(id) {
        if (id === "react") return react;
        if (id === "react-native") return { Platform: { OS: platform } };
        if (id === "./api") {
          return { api, setAccessToken: (token) => { accessToken = token; } };
        }
        if (id === "./auth-token-key") {
          return {
            AUTH_TOKEN_KEY: "dawaisathi_authToken",
            LEGACY_WEB_AUTH_TOKEN_KEY: "dawaisathi:authToken",
            getAuthTokenStorageKey: (selectedPlatform) =>
              selectedPlatform === "web" ? "dawaisathi:authToken" : "dawaisathi_authToken",
          };
        }
        if (id === "./utils/error-message") return errorMessage;
        if (id === "./utils/storage") return { storage };
        throw new Error(`Unexpected auth import: ${id}`);
      },
    },
    { filename: sourcePath },
  );

  function render() {
    stateCursor = 0;
    module.exports.AuthProvider({ children: null });
    return authValue;
  }

  render();
  return {
    account,
    get accessToken() {
      return accessToken;
    },
    get restoreEffect() {
      return restoreEffect;
    },
    render,
  };
}

async function settleRestore(provider) {
  provider.restoreEffect();
  await new Promise((resolve) => setImmediate(resolve));
  return provider.render();
}

test("native AuthProvider restoration never sends the colon legacy key to SecureStore", async () => {
  const secureCalls = [];
  const secureStore = {
    async getItemAsync(key) {
      secureCalls.push(["get", key]);
      assert.notEqual(key, "dawaisathi:authToken");
      return null;
    },
    async setItemAsync(key) {
      secureCalls.push(["set", key]);
    },
    async deleteItemAsync(key) {
      secureCalls.push(["remove", key]);
    },
  };
  const provider = mountAuthProvider("android", secureStore);
  const auth = await settleRestore(provider);

  assert.deepEqual(secureCalls, [["get", "dawaisathi_authToken"]]);
  assert.equal(auth.status, "signedOut");
  assert.equal(auth.error, null);
  assert.equal(provider.accessToken, null);
});

test("web AuthProvider restoration reads the existing colon-key localStorage session", async () => {
  const values = new Map([["dawaisathi:authToken", JSON.stringify("opaque-existing-session")]]);
  const secureStore = {
    async getItemAsync() {
      assert.fail("Web restoration must use localStorage, not native SecureStore.");
    },
  };
  const localStorage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  const provider = mountAuthProvider("web", secureStore, localStorage);
  const auth = await settleRestore(provider);

  assert.equal(auth.status, "signedIn");
  assert.equal(auth.user, provider.account);
  assert.equal(auth.error, null);
  assert.equal(provider.accessToken, "opaque-existing-session");
});
