const bcrypt = require('bcrypt');

const isValidEmail = (email: string) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};
const isValidDateTime = (value: string) => {
  const timestamp = Date.parse(value);
  return !isNaN(timestamp);
};
async function hashPassword(password: string) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}
export { isValidEmail, isValidDateTime, hashPassword };
