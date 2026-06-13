import { isRecord, parseObjectScopePayload } from './object-relay-parse';
import {
  MAX_TOKEN_OBJECTS,
  type ObjectUploadTokenPayload,
} from './object-relay-types';

export function base64UrlEncode(value: string): string {
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
      .padEnd(Math.ceil(value.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return null;
  }
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function signUploadToken(
  uploadSecret: string,
  payload: ObjectUploadTokenPayload,
): Promise<string> {
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256Hex(uploadSecret, payloadPart);
  return `${payloadPart}.${signature}`;
}

export async function verifyUploadToken(
  uploadSecret: string,
  token: string,
): Promise<ObjectUploadTokenPayload | null> {
  const [payloadPart, signaturePart, ...rest] = token.split('.');
  if (!payloadPart || !signaturePart || rest.length > 0) return null;
  if (!/^[a-f0-9]{64}$/i.test(signaturePart)) return null;

  const expected = await hmacSha256Hex(uploadSecret, payloadPart);
  if (!timingSafeEqualHex(expected, signaturePart.toLowerCase())) return null;

  const decoded = base64UrlDecode(payloadPart);
  if (!decoded) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== 1) return null;
  if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) return null;

  const scope = parseObjectScopePayload(parsed, MAX_TOKEN_OBJECTS);
  if (!scope.ok) return null;
  if (Math.floor(Date.now() / 1000) > parsed.exp) return null;

  return {
    version: 1,
    exp: parsed.exp,
    client_id: scope.value.client_id,
    project_id: scope.value.project_id,
    run_id: scope.value.run_id,
    objects: scope.value.objects,
  };
}
