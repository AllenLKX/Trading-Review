export const SESSION_COOKIE_NAME = "rt_session";

export type SessionPayload = {
  userId: string;
  sessionId: string;
  expiresAt: number;
};

export async function createSignedSession(payload: SessionPayload, secret: string) {
  const encodedPayload = encodeText(JSON.stringify(payload));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function verifySignedSession(value: string | undefined, secret: string | undefined) {
  if (!value || !secret) return null;

  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;

  const encodedPayload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const key = await importSigningKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, decodeBytes(signature), new TextEncoder().encode(encodedPayload));
  if (!valid) return null;

  try {
    const payload = JSON.parse(decodeText(encodedPayload)) as Partial<SessionPayload>;
    if (
      typeof payload.userId !== "string" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

async function sign(value: string, secret: string) {
  const key = await importSigningKey(secret);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encodeBytes(new Uint8Array(bytes));
}

function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function encodeText(value: string) {
  return encodeBytes(new TextEncoder().encode(value));
}

function decodeText(value: string) {
  return new TextDecoder().decode(decodeBytes(value));
}

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
