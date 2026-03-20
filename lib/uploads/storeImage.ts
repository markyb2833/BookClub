import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { contentTypeForExt, imageExtFromMagic } from "@/lib/uploads/imageMagic";

type Ext = NonNullable<ReturnType<typeof imageExtFromMagic>>;

export async function storeUploadedImage(buffer: Buffer, ext: Ext): Promise<string> {
  const key = `${randomUUID()}.${ext}`;
  const contentType = contentTypeForExt(ext);

  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");

  if (bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && publicBase) {
    const client = new S3Client({ region });
    const prefix = process.env.S3_KEY_PREFIX?.replace(/^\//, "").replace(/\/$/, "") || "bookclub";
    const objectKey = `${prefix}/${key}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `${publicBase}/${objectKey}`;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), buffer);
  return `/uploads/${key}`;
}
