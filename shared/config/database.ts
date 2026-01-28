import path from 'path';
import dotenv from 'dotenv';
import logger from '../utils/logger';

import { Sequelize } from 'sequelize';

dotenv.config();

export const db = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false,
  }
);

try {
  db.authenticate().then((r) => logger.info(r));
  logger.info('Connection has been established successfully.');
} catch (error) {
  logger.error(`Unable to connect to the database: ${error.message}`);
}

// Resolve path for config
export const config = {
  config: path.resolve('config', 'config.js'),
};

export default db;
