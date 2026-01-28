import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

// Base logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'otp',
    ],
    remove: true,
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: false,
        },
      },
});

export default logger;
