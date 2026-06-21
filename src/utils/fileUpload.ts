import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ALLOWED_FILE_TYPE } from './constants';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const env = process.env.NODE_ENV ?? 'dev';
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', env);
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const user = req.user;
    const uniqueName = Date.now() + '-' + `${user?.id}`;
    cb(
      null,
      file.fieldname + '-' + uniqueName + path.extname(file.originalname),
    );
  },
});
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_FILE_TYPE.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG and WebP files are allowed'));
    }
    cb(null, true);
  },
});
export { upload };
