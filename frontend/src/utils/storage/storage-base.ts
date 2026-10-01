// Abstract base for the storage wrapper — shared types + helpers.
// Concrete implementations live in index.ts (native) and index.web.ts (web).

import { getErrorMessage } from "../error-message";

export type StorageItemKey = string;
export type StorageItemValue = string | number | boolean | null;

function isValidSecureKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && !/[^A-Za-z0-9._-]/.test(key);
}

export class StorageOperationError extends Error {
  constructor(operation: string, cause: unknown) {
    const reason = getErrorMessage(cause, "The platform reported an unknown storage error");
    super(`Secure storage could not ${operation}${reason ? `: ${reason}` : "."}`);
    this.name = "StorageOperationError";
  }
}

// Helper for subclasses to enforce that they don't declare methods beyond
// StorageBase. Use as: type _ = AssertNoExtras<Exclude<keyof Storage, keyof StorageBase>>;
export type AssertNoExtras<T extends never> = T;

export abstract class StorageBase {
  protected validateSecureKey(key: StorageItemKey): void {
    if (!isValidSecureKey(key)) {
      throw new Error(
        'Invalid secure storage key. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".',
      );
    }
  }

  protected warn(op: string, key: StorageItemKey, e: unknown) {
    console.warn(`[storage] ${op}(${key}) failed: ${getErrorMessage(e, "Unknown storage error")}`);
  }

  protected failSecureOperation(operation: string, error: unknown): never {
    this.warn(`secure${operation}`, "[redacted]", error);
    throw new StorageOperationError(operation, error);
  }

  protected warnSecureStoreKeyRejection(operation: string, key: StorageItemKey, error: unknown): void {
    if (!getErrorMessage(error, "").startsWith("Invalid key provided to SecureStore.")) return;

    const invalidCodePoints = [
      ...new Set(
        Array.from(key)
          .filter((character) => /[^A-Za-z0-9._-]/.test(character))
          .map((character) => {
            const codePoint = character.codePointAt(0) ?? 0;
            return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
          }),
      ),
    ].slice(0, 16);
    console.warn(
      `[storage] SecureStore rejected key: operation=${operation} keyValid=${isValidSecureKey(
        key,
      )} keyLength=${Array.from(key).length} invalidCodePoints=${invalidCodePoints.join(",") || "none"}`,
    );
  }

  // raw is whatever AsyncStorage / SecureStore returned: a JSON-encoded string
  // (because setItem always JSON.stringifies) or null if the key was missing.
  // We always JSON.parse so values round-trip correctly across types.
  protected retrieve<Fallback extends StorageItemValue>(
    raw: string | null,
    fallback: Fallback,
  ): Fallback | null {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as Fallback;
    } catch (e) {
      this.warn("retrieve", "parse error", e);
      return fallback;
    }
  }

  abstract getItem<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null>;
  abstract setItem<Value extends StorageItemValue>(
    key: string,
    value: Value,
  ): Promise<boolean>;
  abstract removeItem(key: string): Promise<boolean>;
  abstract secureGet<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null>;
  abstract secureSet<Value extends StorageItemValue>(
    key: string,
    value: Value,
  ): Promise<boolean>;
  abstract secureRemove(key: string): Promise<boolean>;
}
