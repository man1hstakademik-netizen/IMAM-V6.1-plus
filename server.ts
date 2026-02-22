import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { URL } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { verifyIdToken } from './src/lib/sso.ts';
import { Role, normalizeRole } from './src/auth/roles.ts';
import { Permission, getPermissions, hasPermission, type RBACRole } from './src/auth/rbac.ts';
import type { Permission as PermissionValue } from './src/auth/permissions.ts';
import { getTelemetrySnapshot, recordTelemetryEvent } from './src/services/securityTelemetry.ts';


type AuthContext = {
  userId: string;
  role: RBACRole;
  permissions: readonly PermissionValue[];
};

const port = Number(process.env.PORT || 3000);
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
const isProduction = process.env.NODE_ENV === 'production';
const AI_RATE_LIMIT_PER_MINUTE = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 30);
const aiLimiter = new Map<string, { count: number; resetAt: number }>();

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<any> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const getRequestMeta = (req: IncomingMessage) => ({
  requestId: req.headers['x-request-id']?.toString() ?? crypto.randomUUID(),
  ip: req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown',
  userAgent: req.headers['user-agent']?.toString() ?? 'unknown',
});


const recordForbiddenAttempt = (args: {
  role: RBACRole;
  permission: Permission;
  route: string;
  userId: string;
  ip: string;
  userAgent: string;
}) => {
  recordTelemetryEvent({
    type: 'FORBIDDEN_ATTEMPT',
    role: args.role,
    permission: args.permission,
    route: args.route,
    userId: args.userId,
    ip: args.ip,
    userAgent: args.userAgent,
    timestamp: new Date().toISOString(),
  });
};

const authenticate = async (req: IncomingMessage): Promise<AuthContext | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const payload = await verifyIdToken(token);
  const role = normalizeRole(payload.role, Role.TAMU);
  const userId = typeof payload.sub === 'string' ? payload.sub : typeof payload.user_id === 'string' ? payload.user_id : 'unknown';

  return {
    userId,
    role,
    permissions: getPermissions(role),
  };
};

const enforceRateLimit = (key: string): boolean => {
  const now = Date.now();
  const current = aiLimiter.get(key);

  if (!current || current.resetAt <= now) {
    aiLimiter.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (current.count >= AI_RATE_LIMIT_PER_MINUTE) return false;

  current.count += 1;
  return true;
};

const serveProductionAsset = async (requestPath: string, res: ServerResponse) => {
  const distRoot = join(process.cwd(), 'dist');
  const normalized = normalize(requestPath).replace(/^\/+/u, '');
  const candidate = join(distRoot, normalized || 'index.html');

  const existingPath = existsSync(candidate) ? candidate : join(distRoot, 'index.html');
  const fileStat = await stat(existingPath);

  res.statusCode = 200;
  res.setHeader('Content-Length', fileStat.size);
  res.setHeader('Content-Type', MIME_TYPES[extname(existingPath)] ?? 'application/octet-stream');
  createReadStream(existingPath).pipe(res);
};

async function bootstrap() {
  const vite = isProduction
    ? null
    : await createViteServer({
        server: { middlewareMode: true, host: '0.0.0.0' },
        appType: 'spa',
      });

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const meta = getRequestMeta(req);

    try {
      if (req.method === 'POST' && requestUrl.pathname === '/api/gemini') {
        if (!geminiApiKey) return sendJson(res, 500, { error: 'Gemini API key is not configured on server.' });

        const auth = await authenticate(req);
        const actorRole = auth?.role ?? Role.TAMU;
        const actorUserId = auth?.userId ?? 'anonymous';

        if (isProduction && (!auth || !hasPermission(auth.role, Permission.ACCESS_AI))) {
          recordForbiddenAttempt({
            role: actorRole,
            permission: Permission.ACCESS_AI,
            route: requestUrl.pathname,
            userId: actorUserId,
            ip: meta.ip,
            userAgent: meta.userAgent,
          });
          recordTelemetryEvent({
            type: 'AI_REQUEST_DENIED',
            role: actorRole,
            permission: Permission.ACCESS_AI,
            route: requestUrl.pathname,
            userId: actorUserId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            timestamp: new Date().toISOString(),
          });
          return sendJson(res, 403, { error: 'Forbidden' });
        }

        const limiterKey = `${meta.ip}:${actorUserId}`;
        if (!enforceRateLimit(limiterKey)) {
          recordTelemetryEvent({
            type: 'RATE_LIMIT_HIT',
            role: actorRole,
            permission: Permission.ACCESS_AI,
            route: requestUrl.pathname,
            userId: actorUserId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            timestamp: new Date().toISOString(),
          });
          return sendJson(res, 429, { error: 'Rate limit exceeded' });
        }

        const body = await readBody(req);
        const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const payload = await upstream.json();
        recordTelemetryEvent({
          type: upstream.ok ? 'AI_REQUEST_GRANTED' : 'AI_REQUEST_DENIED',
          role: actorRole,
          permission: Permission.ACCESS_AI,
          route: requestUrl.pathname,
          userId: actorUserId,
          ip: meta.ip,
          userAgent: meta.userAgent,
          timestamp: new Date().toISOString(),
        });

        console.info('[AUDIT]', {
          requestId: meta.requestId,
          userId: actorUserId,
          action: 'AI_REQUEST',
          success: upstream.ok,
          ip: meta.ip,
          userAgent: meta.userAgent,
          timestamp: new Date().toISOString(),
        });
        return sendJson(res, upstream.status, payload);
      }

      if (req.method === 'POST' && requestUrl.pathname === '/api/audit') {
        const auth = await authenticate(req);
        if (isProduction && !auth) return sendJson(res, 401, { error: 'Unauthorized' });

        const body = await readBody(req);
        console.info('[AUDIT]', {
          requestId: body?.requestId ?? meta.requestId,
          userId: body?.userId ?? auth?.userId ?? 'anonymous',
          action: body?.action,
          target: body?.target,
          success: body?.success ?? true,
          ip: body?.ip ?? meta.ip,
          userAgent: body?.userAgent ?? meta.userAgent,
          timestamp: body?.timestamp ?? new Date().toISOString(),
        });
        return sendJson(res, 201, { ok: true });
      }


      if (req.method === 'GET' && requestUrl.pathname === '/api/security/metrics') {
        const auth = await authenticate(req);
        if (!auth || !hasPermission(auth.role, Permission.VIEW_ANALYTICS)) {
          recordForbiddenAttempt({
            role: auth?.role ?? Role.TAMU,
            permission: Permission.VIEW_ANALYTICS,
            route: requestUrl.pathname,
            userId: auth?.userId ?? 'anonymous',
            ip: meta.ip,
            userAgent: meta.userAgent,
          });
          return sendJson(res, 403, { error: 'Forbidden' });
        }

        return sendJson(res, 200, getTelemetrySnapshot());
      }

      if (isProduction) {
        await serveProductionAsset(requestUrl.pathname, res);
        return;
      }

      vite?.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end('Not found');
      });
    } catch (error) {
      console.error('Unhandled server error', error);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`IMAM server running on http://0.0.0.0:${port} (${isProduction ? 'production' : 'development'})`);
  });
}

bootstrap();
