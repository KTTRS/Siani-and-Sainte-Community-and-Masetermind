import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string | undefined)?.trim();
  const id = incoming && incoming.length > 0 && incoming.length <= 128
    ? incoming
    : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
