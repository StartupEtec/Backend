import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'backend-auth-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...metadata }) => {
          let metaStr = '';
          if (Object.keys(metadata).length) {
            // Remove sensitive fields just in case
            const sanitizedMeta = { ...metadata };
            delete sanitizedMeta.password;
            delete sanitizedMeta.token;
            delete sanitizedMeta.otp;
            delete sanitizedMeta.otp_code;
            delete sanitizedMeta.refreshToken;
            if (Object.keys(sanitizedMeta).length) {
              metaStr = ` ${JSON.stringify(sanitizedMeta)}`;
            }
          }
          return `[${timestamp}] [${level}]: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});

export default logger;
