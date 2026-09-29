import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function createR2Client() {
  for (const name of ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
    if (!process.env[name]?.trim()) throw new Error(`Configure ${name} antes do teste.`);
  }
  return new S3Client({
    region: "auto", endpoint: process.env.R2_ENDPOINT, forcePathStyle: true,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export async function listR2Objects(client, prefix) {
  const objects = [];
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET, Prefix: prefix, ContinuationToken: token,
    }));
    objects.push(...(page.Contents ?? []));
    token = page.NextContinuationToken;
  } while (token);
  return objects;
}

export async function deleteR2Prefix(client, prefix) {
  if (!prefix.endsWith("/") || prefix.length < 10) throw new Error("Use um prefixo específico de teste.");
  const objects = await listR2Objects(client, prefix);
  for (let offset = 0; offset < objects.length; offset += 1000) {
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET,
      Delete: { Objects: objects.slice(offset, offset + 1000).map(({ Key }) => ({ Key })) },
    }));
    if (result.Errors?.length) throw new Error("Falha ao limpar objetos de teste no R2.");
  }
}

export async function putR2Object(client, key, body, contentType = "image/png") {
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: contentType, IfNoneMatch: "*",
  }));
}
