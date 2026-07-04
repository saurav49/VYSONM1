import { Pool } from 'pg';

// Using environment variables is recommended for security
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || 'root123',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// host: localhost
// port: 5432
// user: postgres
// password: root123

export const query = (text: string, params?: any[]) => pool.query(text, params);
