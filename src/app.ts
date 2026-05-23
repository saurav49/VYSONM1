import dotenv from 'dotenv';
import express, { Router, Request, Response, NextFunction } from 'express';
import { insertIntoTable } from './scripts/insertIntoTable';
import { batchInsert } from './scripts/batchInsert';
import { nanoid } from 'nanoid';
import cors from 'cors';
import { query } from './config/db';

dotenv.config();

function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
}
const routes = Router();

const app = express();
app.use(
  cors({
    origin: '*', // REMOVE IN PRODUCTION
  }),
);
app.use(express.json());
app.use('/api/v1', routes);
app.use(errorHandler);

routes.get('/ping', (_req, res) => {
  return res.status(200).json({
    status: true,
    message: 'Server up and running',
  });
});
routes.post('/shorten', async (req, res) => {
  try {
    const { originalUrl } = req.body;
    if (!originalUrl) {
      return res.status(400).json({
        status: false,
        message: 'Original url is required',
      });
    }
    let shortCode = '';
    shortCode = nanoid(10);
    await insertIntoTable({
      original_url: originalUrl,
      short_code: shortCode,
    });
    return res.status(201).json({
      status: true,
      data: {
        originalUrl,
        shortCode,
      },
    });
  } catch (e) {
    return res.status(500).json({
      status: false,
      error: e,
    });
  }
});
routes.get('/redirect', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({
      status: false,
      message: 'Code is required',
    });
  }
  const result = await query(
    `SELECT *
    FROM url_shortener
    WHERE short_code = $1
    `,
    [code],
  );
  const originalUrl = result.rows[0]?.original_url;
  if (!originalUrl) {
    return res.status(400).json({
      status: false,
      message: 'No url exists with this code',
    });
  }
  return res.redirect(originalUrl);
});

// routes.get('/get-db-info', async (_req, res) => {
//   const r = await query(
//     `SELECT pg_size_pretty(pg_total_relation_size('url_shortener'));`,
//   );
//   const rowsInfo = await query(
//     `
//     SELECT COUNT(*)
//     FROM url_shortener
//     `,
//   );
//   return res.status(200).json({
//     status: true,
//     data: { size: r?.rows[0], rows: rowsInfo?.rows[0]?.count },
//   });
// });
// [];
// routes.get('/get-original-urls', async (_req, res) => {
//   const ITERATIONS = 10000000;
//   const start = performance.now();
//   for (let i = 0; i < ITERATIONS; i++) {
//     await query(
//       `
//                 SELECT original_url
//                 FROM url_shortener
//                 WHERE short_code IN ('cdYfjjnbNl', 'gBAoMksiai', '1YETtz-Bg4', 'ij9yPVlQ1G', 'c9mQlN3l0Z')
//       `,
//     );
//   }
//   const end = performance.now();
//   console.log(
//     `API (/get-original-urls) ran 1M times took ${(end - start).toFixed(2)} ms`,
//   );
//   return res.status(200).json({
//     status: true,
//     message: 'Executed successfully',
//   });
// });
// routes.post('/iterative-insert-short', async (req, res) => {
//   try {
//     const start = performance.now();
//     const { iteration } = req.body;
//     if (typeof iteration !== 'number' || iteration <= 0) {
//       return res.status(400).json({
//         status: false,
//         message: 'Invalid iteration',
//       });
//     }
//     for (let i = 0; i < iteration; i++) {
//       const originalUrl = `http://examplet/${i}`;
//       let shortCode = '';
//       shortCode = nanoid(10);
//       const q = await query(
//         `
//                 SELECT *
//                 FROM "url_shortener"
//                 WHERE short_code=$1
//                 `,
//         [shortCode],
//       );
//       while (q?.rowCount && q.rowCount > 0) {
//         shortCode = nanoid(10);
//       }
//       await insertIntoTable({
//         original_url: originalUrl,
//         short_code: shortCode,
//       });
//     }
//     const end = performance.now();
//     console.log(
//       `API (/iterative-insert-short) took ${(end - start).toFixed(2)} ms`,
//     );
//     return res.status(201).json({
//       status: true,
//       message: 'Successful!!',
//     });
//   } catch (e) {
//     return res.status(500).json({
//       status: false,
//       error: e,
//     });
//   }
// });
// routes.post('/batch-insert-short-one-million', async (req, res) => {
//   try {
//     const start = performance.now();
//     const ITERATION = 1000000;
//     const BATCH = 500;
//     for (let i = 0; i < ITERATION; i += BATCH) {
//       let values: Array<string> = [];
//       for (let j = 0; j < BATCH; j++) {
//         const randomNum = i + j;
//         const originalUrl = `https://google.com/${randomNum}`;
//         let shortCode = '';
//         shortCode = nanoid(10);
//         values.push(`('${originalUrl}', '${shortCode}')`);
//       }
//       await query(
//         `
//                 INSERT INTO url_shortener (original_url, short_code)
//                 VALUES ${values.join(',')}
//             `,
//       );
//     }
//     const end = performance.now();
//     console.log(
//       `API (/batch-insert-short-one-million) took ${(end - start).toFixed(2)} ms`,
//     );
//     return res.status(201).json({
//       status: true,
//       message: 'Successful!!',
//     });
//   } catch (e) {
//     return res.status(500).json({
//       status: false,
//       error: e,
//     });
//   }
// });
// routes.post('/batch-insert-short-ten-million', async (req, res) => {
//   try {
//     const start = performance.now();
//     const ITERATION = 10000000;
//     const BATCH = 500;
//     await query('BEGIN');
//     for (let i = 0; i < ITERATION; i += BATCH) {
//       let values: Array<string> = [];
//       for (let j = 0; j < BATCH; j++) {
//         const randomNum = i + j;
//         const originalUrl = `https://google.com/${randomNum}`;
//         let shortCode = '';
//         shortCode = nanoid(10);
//         values.push(`('${originalUrl}', '${shortCode}')`);
//       }
//       await query(
//         `
//             INSERT INTO url_shortener (original_url, short_code)
//             VALUES ${values.join(',')}
//         `,
//       );
//     }
//     await query('COMMIT'); // use to group multiple operations
//     const end = performance.now();
//     console.log(
//       `API (/batch-insert-short-ten-million) took ${(end - start).toFixed(2)} ms`,
//     );
//     return res.status(201).json({
//       status: true,
//       message: 'Successful!!',
//     });
//   } catch (e) {
//     await query('ROLLBACK');
//     return res.status(500).json({
//       status: false,
//       error: e,
//     });
//   }
// });
// routes.post('/batch-insert-short-hundred-million', async (req, res) => {
//   try {
//     const start = performance.now();
//     const ITERATION = 100000000;
//     const BATCH = 1000;
//     for (let i = 0; i < ITERATION; i += BATCH) {
//       try {
//         await query('BEGIN');
//         let failedInserts: Array<string> = [];
//         const batchValues = [];
//         let values: Array<string> = [];
//         for (let j = 0; j < BATCH; j++) {
//           const randomNum = i + j;
//           const originalUrl = `https://google.com/${randomNum}`;
//           let shortCode = '';
//           shortCode = nanoid(10);
//           values.push(`('${originalUrl}', '${shortCode}')`);
//           batchValues.push(originalUrl);
//         }
//         const tempFailedInserts = await batchInsert({
//           values,
//           batchValues,
//         });
//         failedInserts.push(...tempFailedInserts);
//         while (failedInserts.length > 0) {
//           console.log(`Failed batch: ${i}`);
//           const redoInserts = failedInserts.map((url) => {
//             const shortCode = nanoid(10);
//             return `('${url}', '${shortCode}')`;
//           });
//           failedInserts = await batchInsert({
//             values: redoInserts,
//             batchValues: failedInserts,
//           });
//         }
//         await query('COMMIT'); // use to group multiple operations
//       } catch (e) {
//         await query('ROLLBACK');
//       }
//     }
//     const end = performance.now();
//     console.log(
//       `API (/batch-insert-short-hundred-million) took ${(end - start).toFixed(2)} ms`,
//     );
//     return res.status(201).json({
//       status: true,
//       message: 'Successful!!',
//     });
//   } catch (e) {
//     return res.status(500).json({
//       status: false,
//       error: e,
//     });
//   }
// });

export default app;
