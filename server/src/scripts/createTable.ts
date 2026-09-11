import { query } from '../config/db';

async function createTable() {
  try {
    await query(`
              CREATE TABLE url_shortener 
              (
                  id SERIAL PRIMARY KEY,
                  original_url TEXT NOT NULL,
                  short_code TEXT NOT NULL UNIQUE,
                  created_at TIMESTAMPTZ DEFAULT NOW()
              )
              `);
    console.log(`url_shortener created succesfully`);
  } catch (e) {
    console.error(e);
  }
}
createTable();
