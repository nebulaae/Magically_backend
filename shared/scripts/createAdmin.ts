import bcrypt from "bcrypt";
import db from "../config/database";
import logger from "../utils/logger";
import { User } from "../../src/user/models/User";

export const createAdmin = async () => {
    try {
        await db.authenticate();
        logger.info("Database connected for seeding.");

        const email = "admin@volshebny.by";
        const password = "Volshebny_admin";
        const username = "admin";

        const existingAdmin = await User.findOne({ where: { email } });
        if (existingAdmin) {
            logger.warn("Admin already exists.");
        };

        await User.create({
            email,
            username,
            password,
            fullname: "Super Admin",
            role: "admin",
            verified: true,
            tokens: 999999,
            dailyActions: { count: 0, lastReset: new Date() },
        });

        logger.info(`Admin created successfully: ${email}`);
    } catch (error) {
        logger.error(`Error creating admin: ${error.message}`);
    }
};