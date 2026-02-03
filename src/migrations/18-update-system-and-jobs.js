'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            // 1. Создаем таблицу SystemSettings для глобального промпта
            await queryInterface.createTable('system_settings', {
                key: {
                    type: Sequelize.STRING,
                    primaryKey: true,
                    allowNull: false,
                },
                value: {
                    type: Sequelize.TEXT,
                    allowNull: false,
                },
                createdAt: { type: Sequelize.DATE, allowNull: false },
                updatedAt: { type: Sequelize.DATE, allowNull: false },
            }, { transaction });

            // Добавляем дефолтный промпт
            await queryInterface.bulkInsert('system_settings', [{
                key: 'ai_system_prompt',
                value: 'Photorealistic, studio lighting, non-destructive retouching; flawless, smooth skin without pores and other face defects; no blemishes, freckles, acne, dark spots, wrinkles, shine; subtle makeup-like finish; even complexion; preserved facial features; crisp eyes/lips; natural hair texture; cinematic color grading. Learn from the uploaded photos and create an image.',
                createdAt: new Date(),
                updatedAt: new Date()
            }], { transaction });

            // 2. Добавляем флаг isPublished в generation_jobs (Task 5)
            await queryInterface.addColumn('generation_jobs', 'isPublished', {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
                allowNull: false
            }, { transaction });

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();
        try {
            await queryInterface.dropTable('system_settings', { transaction });
            await queryInterface.removeColumn('generation_jobs', 'isPublished', { transaction });
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }
};