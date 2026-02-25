import db from '../config/database';
import logger from '../utils/logger';
import { Admin } from '../../src/admin/models/Admin';

export const createAdmin = async () => {
  try {
    await db.authenticate();
    logger.info('Database connected for seeding.');

    const email = 'admin@volshebny.by';
    const password = 'volshebny_admin';
    const username = 'admin';

    const existingAdmin = await Admin.findOne({ where: { email } });

    if (!existingAdmin) {
      await Admin.create({
        email,
        username,
        password,
        fullname: 'Super Admin',
      });
    }

    logger.info(`Admin created successfully: ${email}`);
  } catch (error) {
    logger.error(`Error creating admin: ${error.message}`);
  }
};
