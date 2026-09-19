import { Id } from "../../convex/_generated/dataModel";

export interface GeneratePresignedUrlResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: number;
  contentType: string;
}

export interface UploadFileToR2Options {
  file: File;
  assetType: string;
  generateUploadUrlAction: (args: {
    assetType: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    organizationId?: string;
  }) => Promise<GeneratePresignedUrlResult>;
  organizationId?: string;
}

export interface UploadFileToR2Result {
  storageKey: string;
  uploadUrl: string;
  contentType: string;
}

export interface CreateAssetUploadParams {
  assetType: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  organizationId?: string;
}

export interface CreateAssetUploadResponse {
  assetId: Id<"organization_assets">;
  uploadUrl: string;
  storageKey: string;
  expiresAt: number;
  contentType: string;
}

export interface ConfirmAssetUploadResponse {
  success: boolean;
  assetId: Id<"organization_assets">;
  storageKey: string;
  status: string;
}

export interface UploadAssetToR2Options {
  file: File;
  assetType: string;
  createAssetUploadAction: (args: CreateAssetUploadParams) => Promise<CreateAssetUploadResponse>;
  confirmAssetUploadAction: (args: { assetId: Id<"organization_assets"> }) => Promise<ConfirmAssetUploadResponse>;
  organizationId?: string;
}

export interface UploadAssetToR2Result {
  assetId: Id<"organization_assets">;
  storageKey: string;
  contentType: string;
}

/**
 * Uploads a file directly from the browser to Cloudflare R2 via a presigned PUT URL.
 */
export async function uploadFileToR2({
  file,
  assetType,
  generateUploadUrlAction,
  organizationId,
}: UploadFileToR2Options): Promise<UploadFileToR2Result> {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const contentType = file.type || "application/octet-stream";

  // 1. Request short-lived presigned PUT URL from Convex backend
  const { uploadUrl, storageKey } = await generateUploadUrlAction({
    assetType,
    fileName: file.name,
    contentType,
    fileSize: file.size,
    organizationId,
  });

  if (!uploadUrl || !storageKey) {
    throw new Error("Invalid presigned URL response from backend.");
  }

  // 2. Direct HTTP PUT upload to Cloudflare R2 bucket
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload file to storage: ${response.status} ${response.statusText}`
    );
  }

  return {
    storageKey,
    uploadUrl,
    contentType,
  };
}

/**
 * Full Phase 3/4 lifecycle helper:
 * 1. Creates pending record in organization_assets and gets presigned PUT URL.
 * 2. Uploads binary directly to Cloudflare R2.
 * 3. Confirms upload with backend.
 * 4. Returns assetId for saving into parent record.
 */
export async function uploadAssetToR2({
  file,
  assetType,
  createAssetUploadAction,
  confirmAssetUploadAction,
  organizationId,
}: UploadAssetToR2Options): Promise<UploadAssetToR2Result> {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  const contentType = file.type || "application/octet-stream";

  // 1. Create asset upload in R2 (inserts pending record in organization_assets)
  const { assetId, uploadUrl, storageKey } = await createAssetUploadAction({
    assetType,
    fileName: file.name,
    contentType,
    fileSize: file.size,
    organizationId,
  });

  if (!uploadUrl || !assetId) {
    throw new Error("Invalid presigned upload response from backend.");
  }

  // 2. Direct HTTP PUT upload to Cloudflare R2 bucket
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload file to storage: ${response.status} ${response.statusText}`
    );
  }

  // 3. Confirm asset upload in organization_assets
  await confirmAssetUploadAction({
    assetId,
  });

  return {
    assetId,
    storageKey,
    contentType,
  };
}
