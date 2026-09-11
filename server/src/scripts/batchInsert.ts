import { query } from '../config/db';

export async function batchInsert({
  values,
  batchValues,
}: {
  values: Array<string>;
  batchValues: Array<string>;
}) {
  const r = await query(
    `
                INSERT INTO url_shortener (original_url, short_code)
                VALUES ${values.join(',')}
                ON CONFLICT (short_code) DO NOTHING
                RETURNING original_url
            `,
  );
  const successInserts = new Set();
  r.rows.forEach((insert) => successInserts.add(insert.original_url));
  return batchValues.filter((v) => !successInserts.has(v));
}
