import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  DLQ_ALERT_EMAIL: process.env.DLQ_ALERT_EMAIL,
};
