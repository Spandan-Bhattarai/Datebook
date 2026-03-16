// src/lib/auth.js

const DEFAULT_ITERATIONS = 210000;

function getEnvAuth() {
  const usernameSalt = import.meta.env.VITE_AUTH_USERNAME_SALT || '';
  const usernameHash = (import.meta.env.VITE_AUTH_USERNAME_HASH || '').trim().toLowerCase();
  const passwordSalt = import.meta.env.VITE_AUTH_PASSWORD_SALT || '';
  const passwordHash = (import.meta.env.VITE_AUTH_PASSWORD_HASH || '').trim().toLowerCase();
  const iterationsRaw = Number(import.meta.env.VITE_AUTH_ITERATIONS || DEFAULT_ITERATIONS);
  const iterations = Number.isFinite(iterationsRaw) && iterationsRaw > 0
    ? Math.floor(iterationsRaw)
    : DEFAULT_ITERATIONS;

  return { usernameSalt, usernameHash, passwordSalt, passwordHash, iterations };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2Hex(value, salt, iterations) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(value), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: enc.encode(salt),
    iterations,
    hash: 'SHA-256',
  }, baseKey, 256);

  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isAuthConfigured() {
  const cfg = getEnvAuth();
  return !!(cfg.usernameSalt && cfg.usernameHash && cfg.passwordSalt && cfg.passwordHash);
}

export async function verifyLogin(usernameInput, passwordInput) {
  const cfg = getEnvAuth();
  if (!cfg.usernameSalt || !cfg.usernameHash || !cfg.passwordSalt || !cfg.passwordHash) return false;

  const normalizedUser = String(usernameInput || '').trim();
  const userComputed = await pbkdf2Hex(normalizedUser, cfg.usernameSalt, cfg.iterations);
  if (!timingSafeEqual(userComputed, cfg.usernameHash)) return false;

  const passComputed = await pbkdf2Hex(String(passwordInput || ''), cfg.passwordSalt, cfg.iterations);
  return timingSafeEqual(passComputed, cfg.passwordHash);
}
