import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const PRIVATE_PREFIX = "private";
const PUBLIC_PREFIX = "public";

let _client: S3Client | null = null;
let _bucket: string | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} must be set. Configure the S3-compatible object storage bucket ` +
        `environment variables (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) ` +
        `before using photo upload/download features.`
    );
  }
  return value;
}

/** Lazily-initialized S3 client, configured for any S3-compatible provider (Railway, MinIO, R2, etc). */
export function getObjectStorageClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: requiredEnv("S3_ENDPOINT"),
    region: process.env.S3_REGION || "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
  return _client;
}

function getBucket(): string {
  if (_bucket) return _bucket;
  _bucket = requiredEnv("S3_BUCKET");
  return _bucket;
}

/** Lightweight handle to an object in the bucket, standing in for the old GCS `File` type. */
export interface StorageObject {
  key: string;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await getObjectStorageClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return true;
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      return false;
    }
    throw err;
  }
}

export class ObjectStorageService {
  constructor() {}

  async searchPublicObject(filePath: string): Promise<StorageObject | null> {
    const key = `${PUBLIC_PREFIX}/${filePath}`;
    if (await objectExists(key)) {
      return { key };
    }
    return null;
  }

  async downloadObject(file: StorageObject, cacheTtlSec: number = 3600): Promise<Response> {
    const client = getObjectStorageClient();
    const bucket = getBucket();

    const getResult = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: file.key })
    );
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const headers: Record<string, string> = {
      "Content-Type": getResult.ContentType || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (getResult.ContentLength) {
      headers["Content-Length"] = String(getResult.ContentLength);
    }

    const body = getResult.Body;
    if (!body) {
      return new Response(null, { headers });
    }
    const webStream = Readable.toWeb(body as Readable) as ReadableStream;
    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const key = `${PRIVATE_PREFIX}/uploads/${objectId}`;

    return getSignedUrl(
      getObjectStorageClient(),
      new PutObjectCommand({ Bucket: getBucket(), Key: key }),
      { expiresIn: 900 }
    );
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageObject> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) {
      throw new ObjectNotFoundError();
    }

    const key = `${PRIVATE_PREFIX}/uploads/${entityId}`;
    if (!(await objectExists(key))) {
      throw new ObjectNotFoundError();
    }
    return { key };
  }

  /** Converts a presigned upload URL (or any full bucket URL) into the app-facing `/objects/:id` path. */
  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("http://") && !rawPath.startsWith("https://")) {
      return rawPath;
    }

    let pathname: string;
    try {
      pathname = new URL(rawPath).pathname;
    } catch {
      return rawPath;
    }

    // Path-style S3 URLs look like /<bucket>/private/uploads/<id>?... — strip bucket + prefix.
    const marker = `/${PRIVATE_PREFIX}/uploads/`;
    const idx = pathname.indexOf(marker);
    if (idx === -1) {
      return pathname;
    }
    const entityId = pathname.slice(idx + marker.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: StorageObject;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async deleteObjectEntity(objectPath: string): Promise<void> {
    const objectFile = await this.getObjectEntityFile(objectPath);
    await getObjectStorageClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: objectFile.key })
    );
  }
}

/** Re-exported for objectAcl.ts, which needs to rewrite metadata via copy-in-place (S3 has no in-place metadata update). */
export async function copyObjectWithMetadata(
  key: string,
  metadata: Record<string, string>
): Promise<void> {
  const bucket = getBucket();
  await getObjectStorageClient().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: `${bucket}/${key}`,
      Metadata: metadata,
      MetadataDirective: "REPLACE",
    })
  );
}

export async function headObjectMetadata(key: string): Promise<Record<string, string> | undefined> {
  const result = await getObjectStorageClient().send(
    new HeadObjectCommand({ Bucket: getBucket(), Key: key })
  );
  return result.Metadata;
}
