// Web storage (Metro picks index.ts on native).
// General helpers use AsyncStorage's web implementation; secure methods use localStorage directly
// so browser access failures are preserved and can be reported instead of converted to `false`.
// Values supported: string | number | boolean | null (JSON-serialized on disk).
// Usage: import { storage } from "@/src/utils/storage"; await storage.getItem(key, fallback);
// Browsers have no Keychain — secure* helpers use browser localStorage.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { getPhysicalSecureStorageKey } from "../../auth-token-key";
import { AssertNoExtras, StorageBase, StorageItemValue } from "./storage-base";

export class Storage extends StorageBase {
  // General KV — backed by AsyncStorage (its built-in web shim uses IndexedDB).
  async getItem<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return this.retrieve(raw, fallback);
    } catch (e) {
      this.warn("getItem", key, e);
      return fallback;
    }
  }

  async setItem<Value extends StorageItemValue>(
    key: string,
    value: Value,
  ): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      this.warn("setItem", key, e);
      return false;
    }
  }

  async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (e) {
      this.warn("removeItem", key, e);
      return false;
    }
  }

  // Browsers have no Keychain — secure* helpers use localStorage and surface access failures.
  async secureGet<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null> {
    try {
      const physicalKey = getPhysicalSecureStorageKey(key, "web");
      const raw = globalThis.localStorage.getItem(physicalKey);
      return this.retrieve(raw, fallback);
    } catch (error) {
      return this.failSecureOperation("read", error);
    }
  }

  async secureSet<Value extends StorageItemValue>(
    key: string,
    value: Value,
  ): Promise<boolean> {
    try {
      const physicalKey = getPhysicalSecureStorageKey(key, "web");
      globalThis.localStorage.setItem(physicalKey, JSON.stringify(value));
      return true;
    } catch (error) {
      return this.failSecureOperation("save", error);
    }
  }

  async secureRemove(key: string): Promise<boolean> {
    try {
      const physicalKey = getPhysicalSecureStorageKey(key, "web");
      globalThis.localStorage.removeItem(physicalKey);
      return true;
    } catch (error) {
      return this.failSecureOperation("remove", error);
    }
  }
}

export const storage = new Storage();

// Compile-time guard: any new method must be declared in storage-base.ts first.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentional compile-time-only assertion
type _NoExtras = AssertNoExtras<Exclude<keyof Storage, keyof StorageBase>>;
