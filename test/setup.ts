import dotenv from 'dotenv';

dotenv.config();

import db from '../shared/config/database';
import { setupAssociations } from '../shared/models/associations';

setupAssociations();

export const getDb = () => db;
