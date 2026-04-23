import { describe, test, expect } from 'vitest';
import {
  loginSchema,
  signupSchema,
  resetRequestSchema,
  resetConfirmSchema,
} from '@/lib/schemas/auth';

describe('loginSchema', () => {
  test('accepts a valid email + password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: 'password123' });
    expect(r.success).toBe(true);
  });

  test('rejects invalid email with fieldErrors.email', () => {
    const r = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.email?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test('rejects password shorter than 8 chars', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: 'short' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.password?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('signupSchema', () => {
  test('accepts a full valid shape (>= 12 char password — SEC-06)', () => {
    const r = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'passwordabc123', // 14 chars
      passwordConfirm: 'passwordabc123',
      name: 'Alice',
    });
    expect(r.success).toBe(true);
  });

  test('SEC-06 — rejects 8-char password under passwordConfirm minimum too', () => {
    const r = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'abcdefgh', // exactly 8 chars — pre-SEC-06 floor
      passwordConfirm: 'abcdefgh',
      name: 'Alice',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.password?.[0]).toMatch(/12/);
    }
  });

  test('SEC-06 — rejects 11-char password (one short of the floor)', () => {
    const r = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'elevenchars', // 11 chars
      passwordConfirm: 'elevenchars',
      name: 'Alice',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.password?.[0]).toMatch(/12/);
    }
  });

  test('SEC-06 — accepts exactly 12 chars (the new floor)', () => {
    const r = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'twelvechars1', // 12 chars
      passwordConfirm: 'twelvechars1',
      name: 'Alice',
    });
    expect(r.success).toBe(true);
  });

  test('rejects mismatched passwordConfirm under passwordConfirm path (Pitfall 12)', () => {
    const r = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'abcdefghijkl', // 12 chars
      passwordConfirm: 'mnopqrstuvwx', // 12 chars, different
      name: 'Alice',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // The refine path: ['passwordConfirm'] is REQUIRED for this to land
      // under the passwordConfirm field rather than a bare '' key.
      expect(r.error.flatten().fieldErrors.passwordConfirm).toEqual(['Passwords do not match']);
    }
  });

  test('rejects missing name with fieldErrors.name', () => {
    const r = signupSchema.safeParse({
      email: 'a@b.co',
      password: 'passwordabc123', // 14 chars
      passwordConfirm: 'passwordabc123',
      name: '',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.name?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('resetRequestSchema', () => {
  test('accepts a valid email', () => {
    const r = resetRequestSchema.safeParse({ email: 'a@b.co' });
    expect(r.success).toBe(true);
  });

  test('rejects missing/empty email', () => {
    const r = resetRequestSchema.safeParse({ email: '' });
    expect(r.success).toBe(false);
  });
});

describe('resetConfirmSchema', () => {
  test('accepts a valid token + matching passwords (>= 12 chars — SEC-06)', () => {
    const r = resetConfirmSchema.safeParse({
      token: 'sometoken',
      password: 'twelvechars1', // 12 chars
      passwordConfirm: 'twelvechars1',
    });
    expect(r.success).toBe(true);
  });

  test('SEC-06 — rejects 8-char password on reset-confirm', () => {
    const r = resetConfirmSchema.safeParse({
      token: 'sometoken',
      password: 'abcdefgh', // 8 chars
      passwordConfirm: 'abcdefgh',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.password?.[0]).toMatch(/12/);
    }
  });

  test('rejects mismatched passwords under passwordConfirm', () => {
    const r = resetConfirmSchema.safeParse({
      token: 'sometoken',
      password: 'abcdefghijkl', // 12 chars
      passwordConfirm: 'mnopqrstuvwx', // 12 chars, different
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.passwordConfirm).toEqual(['Passwords do not match']);
    }
  });

  test('rejects empty token', () => {
    const r = resetConfirmSchema.safeParse({
      token: '',
      password: 'twelvechars1', // 12 chars
      passwordConfirm: 'twelvechars1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.token?.length ?? 0).toBeGreaterThan(0);
    }
  });
});
