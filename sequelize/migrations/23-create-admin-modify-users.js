'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Создаем таблицу Admins
        await queryInterface.createTable('Admins', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            fullname: { type: Sequelize.STRING, allowNull: false },
            username: { type: Sequelize.STRING, unique: true, allowNull: false },
            email: { type: Sequelize.STRING, unique: true, allowNull: false },
            password: { type: Sequelize.STRING, allowNull: false },
            avatar: { type: Sequelize.STRING },
            createdAt: { type: Sequelize.DATE, allowNull: false },
            updatedAt: { type: Sequelize.DATE, allowNull: false },
        });

        // 2. Удаляем поле role из Users
        await queryInterface.removeColumn('Users', 'role');
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Users', 'role', { type: Sequelize.STRING, defaultValue: 'user' });
        await queryInterface.dropTable('Admins');
    }
};