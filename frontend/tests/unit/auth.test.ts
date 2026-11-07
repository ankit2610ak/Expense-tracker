import { describe, it, expect } from 'vitest';
import {
  generateToken,
  verifyToken,
  getAuthUserId,
  unauthorizedResponse,
} from '../../netlify/functions/_shared/auth';

describe('Unit: Netlify Functions Auth Utility', () => {
  it('generates a valid JWT and verifies payload', () => {
    const payload = { userId: 'user-123', email: 'test@example.com' };
    const token = generateToken(payload);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.email).toBe('test@example.com');
  });

  it('throws on tampered or invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  it('extracts userId from valid Authorization Bearer header', () => {
    const token = generateToken({ userId: 'user-456', email: 'auth@example.com' });
    const req = new Request('http://localhost/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const userId = getAuthUserId(req);
    expect(userId).toBe('user-456');
  });

  it('returns null if Authorization header is missing or malformed', () => {
    const reqNoHeader = new Request('http://localhost/api/auth/me');
    expect(getAuthUserId(reqNoHeader)).toBeNull();

    const reqBadHeader = new Request('http://localhost/api/auth/me', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(getAuthUserId(reqBadHeader)).toBeNull();

    const reqInvalidToken = new Request('http://localhost/api/auth/me', {
      headers: { Authorization: 'Bearer not-a-real-jwt' },
    });
    expect(getAuthUserId(reqInvalidToken)).toBeNull();
  });

  it('creates standard 401 unauthorized response', async () => {
    const res = unauthorizedResponse('Access denied');
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Access denied');
  });
});

