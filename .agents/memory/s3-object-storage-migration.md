---
name: S3-compatible object storage migration (from Replit GCS-backed storage)
description: Notes on swapping Replit's object storage (GCS sidecar) for a generic S3-compatible client while keeping app code unchanged.
---

When replacing Replit's object storage (GCS-backed) with a generic
S3-compatible bucket (Railway bucket storage, R2, MinIO, etc):

- Keep the same `ObjectStorageService` method signatures (search/download/
  upload-URL/entity-file/normalize-path/ACL/delete) so callers (routes,
  schedulers) need zero changes — only the storage backend swaps underneath.
- S3 has **no in-place metadata update** the way GCS's `file.setMetadata()`
  does. To change custom metadata (e.g. an ACL policy JSON blob) on an
  existing object, you must `CopyObjectCommand` the object onto itself with
  `MetadataDirective: "REPLACE"`.
- Use `forcePathStyle: true` on the S3 client — most non-AWS S3-compatible
  providers require path-style addressing (`endpoint/bucket/key`), not
  virtual-hosted style.
- `normalizeObjectEntityPath` must parse the *pathname* of the presigned
  upload URL (not assume a fixed provider hostname pattern), since
  S3-compatible endpoints vary by provider.

**Why:** avoids touching every call site (routes, schedulers, frontend) when
swapping storage providers — the interface boundary is `ObjectStorageService`.
