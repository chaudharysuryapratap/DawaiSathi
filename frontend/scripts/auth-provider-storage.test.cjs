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
  const authTokenKeys = loadAuthTokenKeys();
  const sandbox = {
    module,
    exports: module.exports,
    globalThis: { localStorage },
    console: { warn() {} },
    require(id) {
      if (id === "./storage-base") return { StorageBase };
      if (id === "../../auth-token-key") return authTokenKeys;
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

function loadAuthTokenKeys() {
  const sourcePath = path.resolve("src", "auth-token-key.ts");
  const module = { exports: {} };
  vm.runInNewContext(transpile(sourcePath), { module, exports: module.exports }, { filename: sourcePath });
  return module.exports;
}

function mountAuthProvider(platform, secureStore, localStorage) {
  const sourcePath = path.resolve("src", "auth-context.tsx");
  const module = { exports: {} };
  const states = [];
  let stateCursor = 0;
  let restoreEffect;
  let authValue;
  let accessToken = null;
  let currentAccountCalls = 0;
  const account = { id: "account-1", name: "Test Account", email: "test@example.com" };
  const storage = new (loadStorage(platform, secureStore, localStorage))();
  const authTokenKeys = loadAuthTokenKeys();
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
    currentAccount: async () => {
      currentAccountCalls += 1;
      return account;
    },
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
        if (id === "./auth-token-key") return authTokenKeys;
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
    get currentAccountCalls() {
      return currentAccountCalls;
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

test("native AuthProvider restores persisted sessions without sending the colon key to SecureStore", async () => {
  const secureCalls = [];
  const secureStore = {
    async getItemAsync(key) {
      secureCalls.push(["get", key]);
      assert.notEqual(key, "dawaisathi:authToken");
      return JSON.stringify("opaque-existing-native-session");
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
  assert.equal(auth.status, "signedIn");
  assert.equal(auth.user, provider.account);
  assert.equal(auth.error, null);
  assert.equal(provider.accessToken, "opaque-existing-native-session");
  assert.equal(provider.currentAccountCalls, 1);
});

test("native AuthProvider writes and deletes the mapped session key", async () => {
  const secureCalls = [];
  const values = new Map();
  const secureStore = {
    async getItemAsync(key) {
      secureCalls.push(["get", key]);
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      secureCalls.push(["set", key]);
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      secureCalls.push(["remove", key]);
      values.delete(key);
    },
  };
  const provider = mountAuthProvider("android", secureStore);
  await settleRestore(provider);
  await provider.render().login("test@example.com", "password");
  assert.equal(provider.render().status, "signedIn");
  assert.equal(values.get("dawaisathi_authToken"), JSON.stringify("opaque-session-token"));

  await provider.render().logout();
  assert.equal(provider.render().status, "signedOut");
  assert.equal(values.has("dawaisathi_authToken"), false);
  assert.deepEqual(secureCalls, [
    ["get", "dawaisathi_authToken"],
    ["set", "dawaisathi_authToken"],
    ["remove", "dawaisathi_authToken"],
  ]);
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

test("native storage startup failure is reported as a storage error without an API call", async () => {
  const secureStore = {
    async getItemAsync() {
      throw new Error("Secure storage is unavailable");
    },
  };
  const provider = mountAuthProvider("android", secureStore);
  const auth = await settleRestore(provider);

  assert.equal(auth.status, "error");
  assert.match(auth.error, /Secure storage could not read: Secure storage is unavailable/);
  assert.equal(provider.currentAccountCalls, 0);
  assert.equal(provider.accessToken, null);
});

test("auth restore errors use a session title instead of a backend-connectivity title", () => {
  const sourcePath = path.resolve("app", "auth.tsx");
  const module = { exports: {} };
  const ErrorState = () => null;
  const LoadingState = () => null;
  const React = { createElement: (type, props) => ({ type, props }) };
  const sandbox = {
    module,
    exports: module.exports,
    React,
    require(id) {
      if (id === "react") return React;
      if (id === "@/src/components/auth-screen") return { AuthScreen: () => null };
      if (id === "@/src/components/dawai-ui") return { ErrorState, LoadingState };
      if (id === "@/src/auth-context") {
        return { useAuth: () => ({ status: "error", error: "Secure storage is unavailable", retry() {} }) };
      }
      throw new Error(`Unexpected auth route import: ${id}`);
    },
  };
  vm.runInNewContext(transpile(sourcePath, ts.JsxEmit.React), sandbox, { filename: sourcePath });

  const rendered = module.exports.default();
  assert.equal(rendered.type, ErrorState);
  assert.equal(rendered.props.title, "Could not restore your session");
  assert.equal(rendered.props.icon, "alert-circle-outline");
  assert.equal(rendered.props.message, "Secure storage is unavailable");
});
