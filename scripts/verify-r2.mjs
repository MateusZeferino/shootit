import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createR2Client, deleteR2Prefix, listR2Objects } from "./r2-client.mjs";

const prefix = `__shootit-checks__/${randomUUID()}/`;
const body = Buffer.from("Shootit R2 connectivity check");
let client;
try {
  client = createR2Client();
  await listR2Objects(client, prefix);
  console.log("OK: credenciais e bucket acessíveis.");
  const key = `${prefix}check.png`;
  const upload = await getSignedUrl(client, new PutObjectCommand({
    Bucket: process.env.R2_BUCKET, Key: key, ContentType: "image/png", ContentLength: body.length,
  }), { expiresIn: 60, signableHeaders: new Set(["content-type", "content-length"]) });
  for (const origin of ["http://localhost:3000", "https://shootit-ivory.vercel.app"]) {
    const response = await fetch(upload, { method: "OPTIONS", headers: {
      Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type",
    } });
    assert.equal(response.headers.get("access-control-allow-origin"), origin, "CORS não permite a origem configurada.");
  }
  console.log("OK: CORS para localhost e produção.");
  const put = await fetch(upload, { method: "PUT", headers: { "Content-Type": "image/png" }, body });
  assert.ok(put.ok, `Falha no upload assinado: HTTP ${put.status}`);
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET, Key: key,
    ResponseContentDisposition: 'attachment; filename="check.png"', ResponseCacheControl: "private, no-store",
  });
  const download = await getSignedUrl(client, command, { expiresIn: 60 });
  const get = await fetch(download);
  assert.ok(get.ok, `Falha no download assinado: HTTP ${get.status}`);
  assert.deepEqual(Buffer.from(await get.arrayBuffer()), body);
  assert.match(get.headers.get("content-disposition") ?? "", /attachment/);
  assert.match(get.headers.get("cache-control") ?? "", /no-store/);
  const unsigned = new URL(download);
  unsigned.search = "";
  assert.ok([400, 401, 403, 404].includes((await fetch(unsigned)).status), "O objeto deve exigir assinatura.");
  const expired = await getSignedUrl(client, command, { expiresIn: 1, signingDate: new Date(Date.now() - 60_000) });
  assert.equal((await fetch(expired)).status, 403, "A assinatura expirada deve ser recusada.");
  console.log("OK: upload, download íntegro, bucket privado e expiração de URLs.");
} catch (error) {
  // AWS errors can include credentials/URLs; log only a stable category and status.
  console.error("Falha na verificação R2:", error.name, error.$metadata?.httpStatusCode ?? "");
  if (error.message?.startsWith("Configure R2_")) console.error(error.message);
  if (error instanceof assert.AssertionError) console.error(error.message.split("\n")[0]);
  process.exitCode = 1;
} finally {
  if (client) {
    try { await deleteR2Prefix(client, prefix); console.log("OK: arquivos temporários removidos."); }
    catch { console.error("Falha ao limpar o prefixo de diagnóstico."); process.exitCode = 1; }
    client.destroy();
  }
}
