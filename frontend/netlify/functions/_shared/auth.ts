import jwt from 'jsonwebtoken';

// Handle CJS / ESM module interoperability
const jwtSign = (jwt as any).sign || (jwt as any).default?.sign || jwt;
const jwtVerify = (jwt as any).verify || (jwt as any).default?.verify;

export const JWT_SECRET = process.env.JWT_SECRET || 'expense-tracker-super-secret-key-2026';

export interface AuthPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function generateToken(payload: { userId: string; email: string }): string {
  return jwtSign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwtVerify(token, JWT_SECRET) as AuthPayload;
}

/** Extract authenticated userId from Bearer token, or return null */
export function getAuthUserId(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.split(' ')[1];
    const decoded = verifyToken(token);
    return decoded.userId;
  } catch {
    return null;
  }
}

export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return Response.json({ error: message }, { status: 401 });
}
