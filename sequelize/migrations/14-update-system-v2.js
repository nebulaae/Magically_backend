'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Создаем таблицу для Flux моделей (копия логики TTAPI)
        await queryInterface.createTable('flux_models', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            userId: {
                type: Sequelize.UUID, allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE', onDelete: 'CASCADE',
            },
            name: { type: Sequelize.STRING, allowNull: false },
            description: { type: Sequelize.TEXT, allowNull: true },
            instruction: { type: Sequelize.TEXT, allowNull: true }, // Новое поле
            imagePaths: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
            createdAt: { type: Sequelize.DATE, allowNull: false },
            updatedAt: { type: Sequelize.DATE, allowNull: false },
        });
        await queryInterface.addIndex('flux_models', ['userId']);

        // 2. Добавляем instruction в TTAPI models
        await queryInterface.addColumn('tt_models', 'instruction', {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        // 3. Обновляем Users: telegramId и username constraints
        await queryInterface.addColumn('users', 'telegramId', {
            type: Sequelize.STRING,
            allowNull: true,
            unique: true,
        });

        // Исправление username (сначала удаляем дубликаты/null если есть, в проде аккуратнее)
        // Здесь предполагаем, что база чистая или мы просто накладываем констрейнт
        await queryInterface.changeColumn('users', 'username', {
            type: Sequelize.STRING(16),
            allowNull: false, // Теперь обязательно
            unique: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('flux_models');
        await queryInterface.removeColumn('tt_models', 'instruction');
        await queryInterface.removeColumn('users', 'telegramId');
        await queryInterface.changeColumn('users', 'username', {
            type: Sequelize.STRING(16),
            allowNull: true,
        });
    }
};