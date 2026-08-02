import { query } from '../config/db';

export async function insertIntoTable({
  original_url,
  short_code,
}: {
  original_url: string;
  short_code: string;
}) {
  try {
    await query(
      `
            INSERT INTO url_shortener (original_url, short_code)
            VALUES ($1, $2)
            `,
      [original_url, short_code],
    );
  } catch (e) {
    console.error(e);
  }
}
