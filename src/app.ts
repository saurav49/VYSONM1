import dotenv from 'dotenv';
import express, { Router } from 'express';
import { randomBytes } from 'node:crypto';
import crypto from 'crypto';
import cors from 'cors';
import { prisma } from './lib/prisma';
import {
  deleteCache,
  getCache,
  handleCreateUrlShortener,
  hashPassword,
  isValidEmail,
  setCache,
} from './utils/util';
import {
  apiRequestTimeHandler,
  authHandler,
  blacklistHandler,
  errorHandler,
  loggerHandler,
  tierHandler,
  timeMiddlewareHandler,
} from './utils/middlewares';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
const bcrypt = require('bcrypt');

let cacheHit = 0;
let cacheMiss = 0;

dotenv.config();

const routes = Router();

const app = express();
app.use(
  cors({
    origin: '*', // REMOVE IN PRODUCTION
  }),
);
app.use(express.json());
app.set('trust proxy', true);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// logger middleware
app.use(timeMiddlewareHandler('logger', loggerHandler));
app.use(timeMiddlewareHandler('api-request-time', apiRequestTimeHandler));
app.use(timeMiddlewareHandler('blacklist', blacklistHandler));
app.use('/api/v1', routes);
// error handler middleware
app.use(errorHandler);

// health endpoint
routes.get('/ping', (_req, res) => {
  return res.status(200).json({
    status: true,
    message: 'Server up and running',
  });
});
routes.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: true,
      database: 'CONNECTED',
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({
      status: false,
      database: 'DOWN',
    });
  }
});

// user endpoint
routes.post('/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(401).json({
        status: false,
        message: 'Email and name are required',
      });
    }
    if (!isValidEmail(email)) {
      return res.status(401).json({
        status: false,
        message: 'Invalid email',
      });
    }
    const apiKey = crypto.randomBytes(32).toString('hex');
    const result = await prisma.user.create({
      data: {
        email,
        name,
        apiKey,
      },
    });
    return res.status(201).json({
      status: true,
      data: {
        id: result.id,
        apiKey: result.apiKey,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      status: false,
      message: e,
    });
  }
});
routes.get(
  '/users/short-list',
  timeMiddlewareHandler('auth', authHandler),
  async (req, res) => {
    try {
      const user = (req as any).user;
      const userWithUrls = await prisma.user.findUnique({
        where: {
          apiKey: user.apiKey,
        },
        include: {
          shortens: true,
        },
      });
      if (!userWithUrls) {
        return res.status(401).json({
          status: false,
          message: 'User not found',
        });
      }
      return res.status(200).json({
        status: true,
        data: {
          id: userWithUrls.id,
          email: userWithUrls.email,
          name: userWithUrls.name,
          tier: userWithUrls.tier,
          shortens: userWithUrls.shortens.map((r) => ({
            id: r.id,
            originalUrl: r.originalUrl,
            shortCode: r.shortCode,
            clicks: r.clicks,
            lastAccessedAt: r.lastAccessedAt,
            expiryDate: r.expiryDate,
          })),
        },
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        error: e,
      });
    }
  },
);
routes.delete(
  '/users',
  timeMiddlewareHandler('auth', authHandler),
  async (req, res) => {
    try {
      const user = (req as any).user;
      await prisma.user.update({
        where: {
          apiKey: user.apiKey,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return res.status(200).json({
        status: true,
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        error: e,
      });
    }
  },
);

// shorten endpoint
routes.post(
  '/shorten',
  timeMiddlewareHandler('auth', authHandler),
  async (req, res) => {
    try {
      const { originalUrl, expiryDate, code, password } = req.body;
      let hashedPassword = undefined;
      if (password) {
        hashedPassword = await hashPassword(password);
      }
      const result = await handleCreateUrlShortener({
        req,
        originalUrl,
        expiryDate,
        code,
        hashedPassword,
      });
      return res.status(result.statusCode).json(result.body);
    } catch (e) {
      return res.status(500).json({
        status: false,
        error: e,
      });
    }
  },
);
routes.patch(
  '/shorten',
  timeMiddlewareHandler('auth', authHandler),
  async (req, res) => {
    try {
      const { code, expiryDate, password } = req.body;
      const parsedExpiryDate = expiryDate ? new Date(expiryDate) : undefined;
      let hashedPassword = undefined;
      if (password) {
        hashedPassword = await hashPassword(password);
      }
      const user = (req as any).user;
      const url = await prisma.urlShortener.findFirst({
        where: {
          shortCode: code,
          userId: user.id,
        },
      });
      if (!url) {
        return res.status(404).json({
          status: false,
          message: 'Url not found',
        });
      }
      const result = await prisma.urlShortener.updateMany({
        where: {
          shortCode: code,
          userId: user.id,
        },
        data: {
          expiryDate: parsedExpiryDate,
          password: hashedPassword,
        },
      });
      if (result.count === 0) {
        return res.status(403).json({
          status: false,
          message: 'Forbidden action',
        });
      }
      await deleteCache(code as string);
      return res.status(200).json({
        status: true,
        data: result,
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        error: e,
      });
    }
  },
);
routes.post(
  '/shorten/batch',
  timeMiddlewareHandler('auth', authHandler),
  timeMiddlewareHandler('tier', tierHandler),
  async (req, res) => {
    try {
      const reqs = req.body;
      if (!reqs) {
        return res.status(400).json({
          status: false,
          message: 'Invalid request',
        });
      }
      // allSettled gurantee the order that we pass
      const hashedPasswordResponse = await Promise.allSettled(
        reqs.map((r: { password?: string }) =>
          r?.password ? hashPassword(r.password) : undefined,
        ),
      );
      const hashedPasswordList = hashedPasswordResponse.map((r) =>
        r.status === 'fulfilled' ? r.value : undefined,
      );
      if (reqs && Array.isArray(reqs) && reqs.length > 0) {
        const r = await Promise.allSettled(
          reqs.map((r, idx) => {
            return handleCreateUrlShortener({
              req,
              originalUrl: r.originalUrl,
              expiryDate: r?.expiryDate,
              code: r?.code,
              hashedPassword: hashedPasswordList[idx],
            });
          }),
        );
        const results = r.map((result) => {
          if (result.status === 'fulfilled') {
            return result.value;
          }
          return {
            statusCode: 500,
            body: {
              status: false,
              message: result.reason,
            },
          };
        });
        const statusCode = results.every((result) => result.statusCode === 201)
          ? 201
          : 207;

        return res.status(statusCode).json({
          status: statusCode === 201,
          data: results,
        });
      }
      return res.status(400).json({
        status: false,
        message: 'No batch data found',
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        error: e,
      });
    }
  },
);
routes.delete(
  '/short-codes/:code',
  timeMiddlewareHandler('auth', authHandler),
  async (req, res) => {
    try {
      const { code } = req.params;
      if (!code) {
        return res.status(400).json({
          status: false,
          message: 'Code is required',
        });
      }
      const user = (req as any).user;
      const result = await prisma.urlShortener.updateMany({
        where: {
          shortCode: code as string,
          userId: user.id,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      if (result.count === 0) {
        return res.status(403).json({
          status: false,
          message: 'Forbidden action',
        });
      }
      await deleteCache(code as string);
      return res.status(200).json({
        status: true,
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        error: e,
      });
    }
  },
);

// redirect endpoint
routes.get('/redirect', async (req, res) => {
  const { code, password } = req.query;
  if (!code) {
    return res.status(400).json({
      status: false,
      message: 'Code is required',
    });
  }
  const cachedValue = await getCache(code as string);
  if (cachedValue) {
    return res.redirect(cachedValue);
  }
  const now = new Date().getTime();
  const result = await prisma.urlShortener.findUnique({
    where: {
      shortCode: code as string,
      deletedAt: null,
    },
  });
  if (!result) {
    return res.status(404).json({
      status: false,
      message: 'URL not found',
    });
  }
  const originalUrl = result?.originalUrl;
  if (!originalUrl) {
    return res.status(404).json({
      status: false,
      message: 'URL not found',
    });
  }
  if (result?.password && !password) {
    return res.status(401).json({
      status: false,
      message: 'Unauthorized access',
    });
  }
  if (result?.password && password) {
    const isMatch = await bcrypt.compare(password, result.password);
    if (!isMatch) {
      return res.status(401).json({
        status: false,
        message: 'Unauthorized access',
      });
    }
  }
  const expiryDate = result.expiryDate;
  if (expiryDate && new Date(expiryDate).getTime() < now) {
    return res.status(404).json({
      status: false,
      message: 'URL expired',
    });
  }
  if (!result?.password && !result?.expiryDate && code) {
    await setCache({ code: result.shortCode as string, originalUrl });
  }
  await prisma.urlShortener.update({
    where: {
      shortCode: code as string,
    },
    data: {
      clicks: typeof result?.clicks === 'number' ? result.clicks + 1 : 0,
      lastAccessedAt: new Date(),
    },
  });
  cacheMiss += 1;
  return res.redirect(originalUrl);
});

// benchmark endpoint added to test the /shorten POST request
routes.post('/shorten-benchmark', async (_req, res) => {
  let shortCode = '';
  shortCode = randomBytes(8).toString('base64url').slice(0, 10);
  const originalUrl = `https://terminaltrove.com/oha/${Date.now()}-${shortCode}`;

  const response = await prisma.urlShortener.create({
    data: {
      originalUrl,
      shortCode,
    },
  });

  return res.status(201).json(response);
});

// analytics endpoint
routes.get('/analytics', async (_req, res) => {
  try {
    const tenLatestUrlShortened = await prisma.urlShortener.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const tenMostPopularUrl = await prisma.urlShortener.findMany({
      where: { deletedAt: null },
      orderBy: [{ clicks: 'desc' }, { lastAccessedAt: 'desc' }],
      take: 10,
    });
    const tenMostShortenUrl = await prisma.urlShortener.groupBy({
      where: { deletedAt: null },
      by: ['originalUrl'],
      _count: {
        originalUrl: true,
      },
      orderBy: {
        _count: {
          originalUrl: 'desc',
        },
      },
      take: 10,
    });
    return res.status(200).json({
      status: true,
      data: {
        tenLatestUrlShortened,
        tenMostPopularUrl,
        tenMostShortenUrl,
      },
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
});

routes.get('/cache-stats', async (_req, res) => {
  return res.status(200).json({
    status: true,
    data: {
      cacheHit,
      cacheMiss,
      hitRatio: cacheHit / (cacheMiss + cacheHit),
    },
  });
});
export default app;
