import { Request, Response, NextFunction } from 'express';
import type { ParsedQs } from 'qs';

type OwnedResource = { userId: string | null | undefined } | null | undefined;
type ResourceLoader = (req: Request) => Promise<OwnedResource> | OwnedResource;

/**
 * requireOwnership ensures the authenticated user owns the resource being accessed.
 * Admins and CHWs (care team) bypass ownership for incident response.
 *
 * Usage:
 *   requireOwnership(async (req) => storage.getGoalById(req.params.id))
 */
export function requireOwnership(
  loader: ResourceLoader,
  options: { allowRoles?: string[] } = {},
) {
  const allowRoles = options.allowRoles ?? ['admin', 'chw'];
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (allowRoles.includes(req.authUser.userType)) {
      return next();
    }
    try {
      const resource = await loader(req);
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      if (resource.userId !== req.authUser.id) {
        return res.status(403).json({ error: 'Forbidden: you do not own this resource' });
      }
      next();
    } catch (err) {
      console.error('Ownership check failed:', err);
      return res.status(500).json({ error: 'Ownership verification failed' });
    }
  };
}

/**
 * scopeToAuthUser forces req.body.userId / req.query.userId to match the
 * authenticated user, eliminating IDOR via client-supplied userId.
 * Admins/CHWs may pass through any userId for legitimate cross-user reads.
 */
export function scopeToAuthUser(options: { allowRoles?: string[] } = {}) {
  const allowRoles = options.allowRoles ?? ['admin', 'chw'];
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const isPrivileged = allowRoles.includes(req.authUser.userType);
    if (!isPrivileged) {
      const body = req.body as Record<string, unknown> | undefined;
      if (body && typeof body === 'object') {
        body.userId = req.authUser.id;
      }
      const query = req.query as ParsedQs;
      if (query && typeof query === 'object') {
        query.userId = req.authUser.id;
      }
    }
    next();
  };
}
