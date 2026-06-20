import { Router } from 'express';
import { analytics } from './analytics.controller';

const analyticsRouter = Router();

analyticsRouter.get('/analytics', analytics);

export { analyticsRouter };
