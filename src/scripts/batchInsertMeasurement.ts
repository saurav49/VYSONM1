import { query } from '../db/client';

const INTERATIONS = 1000;
const BATCH_SIZE = 75;
async function batchInsertMeasurement() {
  const start = performance.now();
  try {
    for (let i = 0; i < INTERATIONS; i += BATCH_SIZE) {
      let values = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
        values.push(
          `('name_${i + j}', '${Math.floor(Math.random() * 7)}', '${Math.floor(Math.random() * 20)}')`,
        );
      }
      await query(`
              INSERT INTO measurements (name, feet, inches) VALUES ${values.join(',')}
          `);
    }
    const end = performance.now();
    console.log(
      `API (/batch-insert-1million-measurements) took ${(end - start).toFixed(2)} ms`,
    );
  } catch (e) {
    console.error({ e });
    throw e;
  }
}
batchInsertMeasurement();
