import { Router } from 'express';
import { analytics } from './analytics.controller';
import { analyticsEvents } from './analytics.controller';

const analyticsRouter = Router();

analyticsRouter.get('/analytics', analytics);
analyticsRouter.get('/leaderboard/events', analyticsEvents);

export { analyticsRouter };
