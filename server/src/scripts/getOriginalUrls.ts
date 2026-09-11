import { query } from '../config/db';

async function getOriginalUrls() {
  const ITERATIONS = 10000000;
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    console.log(`Batch no: ${i}`);
    await query(
      `
        SELECT original_url
        FROM url_shortener
        WHERE short_code IN ('cdYfjjnbNl', 'aEFcX6DLrN', 'bmzU5gsaNu', 'ij9yPVlQ1G', 'c9mQlN3l0Z')
      `,
    );
  }
  const end = performance.now();
  console.log(
    `API (/get-original-urls) ran 1M times took ${(end - start).toFixed(2)} ms`,
  );
}
getOriginalUrls();
