import { Router } from 'express';
import { health, ping } from './health.controller';

const healthRouter = Router();

healthRouter.get('/ping', ping);
healthRouter.get('/health', health);

export { healthRouter };
