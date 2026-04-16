import path from 'path';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import { TransformableInfo } from 'logform';

const createLogDirs = () => {
  const dirs = ['logs/winston/successes', 'logs/winston/errors'];
  dirs.forEach(dir => {
    if (!fs.existsSync(path.join(process.cwd(), dir))) {
      fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
    }
  });
};

const { combine, timestamp, label, printf } = format;

const myFormat = printf((info: TransformableInfo) => {
  const { level, message, label, timestamp } = info;
  const date = new Date(timestamp as string);
  const hour = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `{${date.toDateString()} ${hour}:${minutes}:${seconds}} [${label}] ${level}: ${message}`;
});

createLogDirs();

const logger = createLogger({
  level: 'info',
  format: combine(label({ label: 'FIXMATE 🛠️' }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'winston', 'successes', 'fixmate-%DATE%-success.log'),
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

const errorLogger = createLogger({
  level: 'error',
  format: combine(label({ label: 'FIXMATE 🐞' }), timestamp(), myFormat),
  transports: [
    new transports.Console(),
    new DailyRotateFile({
      filename: path.join(process.cwd(), 'logs', 'winston', 'errors', 'fixmate-%DATE%-error.log'),
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

export { logger, errorLogger };
