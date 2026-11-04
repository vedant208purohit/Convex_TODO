import { GenericCredentialBundle } from "./paymentGatewayTypes";

const DEFAULT_DEV_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 32-byte fallback for dev/tests

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Resolves the AES-256-GCM symmetric CryptoKey for a given key version.
 */
export async function getCryptoKeyForVersion(version = 1): Promise<CryptoKey> {
  const envVarName = `PAYMENT_GATEWAY_ENCRYPTION_KEY_V${version}`;
  const isProd = typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production";
  const keyFromEnv = (typeof process !== "undefined" && process.env)
    ? (process.env[envVarName] || process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY)
    : undefined;

  let rawKeyBytes: Uint8Array;
  if (keyFromEnv) {
    if (keyFromEnv.length === 64) {
      rawKeyBytes = hexToBytes(keyFromEnv);
    } else {
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(keyFromEnv)
      );
      rawKeyBytes = new Uint8Array(hashBuffer);
    }
  } else {
    if (isProd) {
      throw new Error(
        "ENCRYPTION_CONFIGURATION_MISSING: Dedicated PAYMENT_GATEWAY_ENCRYPTION_KEY_V1 is required in production."
      );
    }
    rawKeyBytes = hexToBytes(DEFAULT_DEV_KEY_HEX);
  }

  return await crypto.subtle.importKey(
    "raw",
    rawKeyBytes as any,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedPayload {
  version: number;
  iv: string; // hex
  tag?: string; // hex (in WebCrypto, tag is stored within ciphertext)
  ciphertext: string; // hex
}

/**
 * Encrypts a credential bundle using authenticated AES-256-GCM via Web Crypto API.
 */
export async function encryptCredentials(
  bundle: GenericCredentialBundle,
  version = 1
): Promise<{ encryptedString: string; version: number }> {
  const key = await getCryptoKeyForVersion(version);
  const iv = new Uint8Array(12); // 96-bit IV
  crypto.getRandomValues(iv);

  const encodedData = new TextEncoder().encode(JSON.stringify(bundle));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    encodedData as any
  );

  const payload: EncryptedPayload = {
    version,
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(ciphertextBuffer)),
  };

  return {
    encryptedString: JSON.stringify(payload),
    version,
  };
}

/**
 * Decrypts an authenticated AES-256-GCM credential bundle via Web Crypto API.
 */
export async function decryptCredentials(encryptedString: string): Promise<GenericCredentialBundle> {
  const payload: EncryptedPayload = JSON.parse(encryptedString);
  const key = await getCryptoKeyForVersion(payload.version);
  const iv = hexToBytes(payload.iv);
  const ciphertextBytes = hexToBytes(payload.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    ciphertextBytes as any
  );

  const jsonString = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(jsonString);
}

/**
 * Masks a credential or key identifier for safe client UI display.
 * E.g., "rzp_live_1234567890abcdef" -> "rzp_live_•••••••cdef"
 */
export function maskKeyIdentifier(keyId?: string): string | undefined {
  if (!keyId) return undefined;
  if (keyId.length <= 8) return "••••••••";
  const prefix = keyId.slice(0, 8);
  const suffix = keyId.slice(-4);
  return `${prefix}••••${suffix}`;
}
