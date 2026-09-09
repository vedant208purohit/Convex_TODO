/**
 * Cloudflare R2 AWS SigV4 Presigned GET URL Generator
 * Built with standard Web Crypto API (supported across all Convex runtimes: query, mutation, action).
 */

export interface R2SignConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
}

/**
 * Reads R2 configuration from environment variables.
 */
export function getR2SignConfig(): R2SignConfig {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim() || "pos-assets";
  const publicDomain = process.env.R2_PUBLIC_DOMAIN?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Missing required Cloudflare R2 environment variables for signed URL generation."
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicDomain: publicDomain || undefined,
  };
}

/**
 * Computes SHA-256 hex digest using Web Crypto.
 */
async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes HMAC-SHA256 binary digest using Web Crypto.
 */
async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const messageData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return await crypto.subtle.sign("HMAC", cryptoKey, messageData);
}

/**
 * Computes HMAC-SHA256 hex string using Web Crypto.
 */
async function hmacSha256Hex(key: ArrayBuffer, message: string): Promise<string> {
  const digest = await hmacSha256(key, message);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives the AWS SigV4 signing key.
 */
async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const kSecret = encoder.encode("AWS4" + secretKey);
  const kSecretBuf = kSecret.buffer.slice(kSecret.byteOffset, kSecret.byteOffset + kSecret.byteLength) as ArrayBuffer;
  const kDate = await hmacSha256(kSecretBuf, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return await hmacSha256(kService, "aws4_request");
}

/**
 * Generates a standard AWS SigV4 presigned GET URL for Cloudflare R2.
 * Default expiration: 900 seconds (15 minutes).
 */
export async function generateR2SignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 900,
  customConfig?: Partial<R2SignConfig>
): Promise<string> {
  const config: R2SignConfig = {
    ...getR2SignConfig(),
    ...customConfig,
  };

  const cleanStorageKey = storageKey.startsWith("/") ? storageKey.slice(1) : storageKey;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const safeExpires = Math.min(Math.max(expiresInSeconds, 60), 900); // 1 to 15 mins

  // Canonical URI: each path segment must be URI-encoded
  const canonicalUri = "/" + [config.bucketName, ...cleanStorageKey.split("/")].map(encodeURIComponent).join("/");

  // Query parameters in alphabetical order
  const queryParams = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(safeExpires)],
    ["X-Amz-SignedHeaders", "host"],
  ];

  const canonicalQueryString = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // Canonical Request
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const canonicalRequestHash = await sha256Hex(canonicalRequest);

  // String to Sign
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  // Calculate Signature
  const signingKey = await getSigningKey(config.secretAccessKey, dateStamp, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
