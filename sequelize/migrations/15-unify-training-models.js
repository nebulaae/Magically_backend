'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Создаем единую таблицу
        await queryInterface.createTable('training_models', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
            userId: {
                type: Sequelize.UUID, allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE', onDelete: 'CASCADE',
            },
            name: { type: Sequelize.STRING, allowNull: false },
            triggerWord: { type: Sequelize.STRING, allowNull: false, defaultValue: "TOK" }, // Для LoRA
            type: { type: Sequelize.STRING, allowNull: false, defaultValue: "flux" }, // flux, sd, etc.
            provider: { type: Sequelize.STRING, allowNull: false, defaultValue: "unifically" },
            description: { type: Sequelize.TEXT, allowNull: true },
            instruction: { type: Sequelize.TEXT, allowNull: true }, // Системный промпт модели
            imagePaths: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
            trainingId: { type: Sequelize.STRING, allowNull: true }, // ID тренировки на внешнем сервисе
            status: { type: Sequelize.STRING, defaultValue: "ready" }, // creating, training, ready, failed
            createdAt: { type: Sequelize.DATE, allowNull: false },
            updatedAt: { type: Sequelize.DATE, allowNull: false },
        });

        await queryInterface.addIndex('training_models', ['userId']);

        // 2. Удаляем старые таблицы (Осторожно: в проде сначала сделайте бэкап данных!)
        // await queryInterface.dropTable('flux_models');
        // await queryInterface.dropTable('tt_models');
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('training_models');
        // Логика восстановления старых таблиц опускается для краткости
    }
};