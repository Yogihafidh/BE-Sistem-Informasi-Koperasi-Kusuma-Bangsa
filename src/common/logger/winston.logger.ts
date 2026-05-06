import { WinstonModule, utilities as nestWinstonUtilities } from 'nest-winston';
import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.ms(),
  nestWinstonUtilities.format.nestLike('Koperasi API', {
    colors: true,
    prettyPrint: true,
  }),
);

export const winstonLogger = WinstonModule.createLogger({
  level: 'info',
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});
