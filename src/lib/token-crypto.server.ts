// Criptografia dos tokens de pagamento (AES-256-GCM) — apenas servidor.
// Chave derivada de MERCADO_PAGO_ENCRYPTION_KEY (qualquer valor). Formato
// persistido: "enc:v1:<base64(iv + tag + ciphertext)>".
//
// A chave vem de platform_settings (painel admin) ou da env var; se não
// estiver configurada, os valores passam em texto puro — útil apenas para
// desenvolvimento local. Em produção, defina a chave.

import { resolveEncryptionKey } from "@/lib/mp-settings.server";

const ENC_PREFIX = "enc:v1:";

async function getKeyMaterial(): Promise<CryptoKey | null> {
  const secret = await resolveEncryptionKey();
  if (!secret) return null;
  return globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HKDF" },
    false,
    ["deriveKey"],
  );
}

async function deriveKey(): Promise<CryptoKey | null> {
  const material = await getKeyMaterial();
  if (!material) return null;
  return globalThis.crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("weaze-token-v1"), info: new TextEncoder().encode("aes-256-gcm") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptToken(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const key = await deriveKey();
  if (!key) return value;

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const cipher = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipher);

  const payload = new Uint8Array(iv.length + cipherBytes.length);
  payload.set(iv, 0);
  payload.set(cipherBytes, iv.length);

  const toB64 = (buf: Uint8Array) =>
    Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("base64");

  return `${ENC_PREFIX}${toB64(payload)}`;
}

export async function decryptToken(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(ENC_PREFIX)) return value;

  const key = await deriveKey();
  if (!key) throw new Error("MERCADO_PAGO_ENCRYPTION_KEY não configurada para decodificar tokens.");

  const fromB64 = (b64: string) => Buffer.from(b64, "base64");
  const raw = fromB64(value.slice(ENC_PREFIX.length));
  const iv = raw.subarray(0, 12);
  const cipher = raw.subarray(12);

  try {
    const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Falha ao decodificar token de pagamento.");
  }
}
