import { rateLimit } from 'express-rate-limit';

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: 'Too many request from this IP, please try again later',
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
