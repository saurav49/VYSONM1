import { rateLimit } from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Too many request from this IP, please try again later',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const shortenLimiter = rateLimit({
  windowMs: 1000,
  limit: 10,
  keyGenerator: (req) => {
    const key = req.headers['x-api-key'];
    if (typeof key === 'string') {
      return key;
    }
    return req?.ip ?? 'unknown';
  },
  message: 'Too many request from this API Key, please try again later',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const redirectLimiter = rateLimit({
  windowMs: 1000,
  limit: 50,
  message: 'Too many request from this IP, please try again later',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export { limiter, shortenLimiter, redirectLimiter };
