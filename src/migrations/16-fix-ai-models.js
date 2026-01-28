'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // 1. Проверяем существование старых таблиц
            const tables = await queryInterface.showAllTables();
            const hasFluxModels = tables.includes('flux_models');
            const hasTtModels = tables.includes('tt_models');
            const hasTrainingModels = tables.includes('training_models');

            // 2. Если training_models уже существует, удаляем её для пересоздания
            if (hasTrainingModels) {
                await queryInterface.dropTable('training_models', { transaction });
            }

            // 3. Удаляем старый ENUM тип если существует
            try {
                await queryInterface.sequelize.query(
                    'DROP TYPE IF EXISTS "enum_training_models_provider" CASCADE;',
                    { transaction }
                );
            } catch (err) {
                console.log('ENUM type does not exist, skipping...');
            }

            // 4. Создаем новый ENUM тип
            await queryInterface.sequelize.query(
                `CREATE TYPE "enum_training_models_provider" AS ENUM ('unifically', 'ttapi');`,
                { transaction }
            );

            // 5. Создаем новую объединенную таблицу
            await queryInterface.createTable('training_models', {
                id: {
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4,
                    primaryKey: true
                },
                userId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                name: {
                    type: Sequelize.STRING,
                    allowNull: false
                },
                description: {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                instruction: {
                    type: Sequelize.TEXT,
                    allowNull: true
                },
                imagePaths: {
                    type: Sequelize.JSONB,
                    allowNull: false,
                    defaultValue: []
                },
                provider: {
                    type: Sequelize.ENUM('unifically', 'ttapi'),
                    allowNull: false,
                    defaultValue: 'unifically'
                },
                createdAt: {
                    type: Sequelize.DATE,
                    allowNull: false
                },
                updatedAt: {
                    type: Sequelize.DATE,
                    allowNull: false
                }
            }, { transaction });

            // 6. Добавляем индекс
            await queryInterface.addIndex('training_models', ['userId'], { transaction });

            // 7. Мигрируем данные из flux_models
            if (hasFluxModels) {
                await queryInterface.sequelize.query(
                    `INSERT INTO training_models (id, "userId", name, description, instruction, "imagePaths", provider, "createdAt", "updatedAt")
                     SELECT id, "userId", name, description, instruction, "imagePaths", 'unifically'::enum_training_models_provider, "createdAt", "updatedAt"
                     FROM flux_models;`,
                    { transaction }
                );
            }

            // 8. Мигрируем данные из tt_models
            if (hasTtModels) {
                await queryInterface.sequelize.query(
                    `INSERT INTO training_models (id, "userId", name, description, instruction, "imagePaths", provider, "createdAt", "updatedAt")
                     SELECT id, "userId", name, description, instruction, "imagePaths", 'ttapi'::enum_training_models_provider, "createdAt", "updatedAt"
                     FROM tt_models;`,
                    { transaction }
                );
            }

            // 9. Удаляем старые таблицы (только после успешной миграции данных)
            if (hasFluxModels) {
                await queryInterface.dropTable('flux_models', { transaction });
            }
            if (hasTtModels) {
                await queryInterface.dropTable('tt_models', { transaction });
            }

            await transaction.commit();
            console.log('✅ Migration completed successfully');

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Migration failed:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Создаем обратно flux_models
            await queryInterface.createTable('flux_models', {
                id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
                userId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                name: { type: Sequelize.STRING, allowNull: false },
                description: { type: Sequelize.TEXT, allowNull: true },
                instruction: { type: Sequelize.TEXT, allowNull: true },
                imagePaths: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
                createdAt: { type: Sequelize.DATE, allowNull: false },
                updatedAt: { type: Sequelize.DATE, allowNull: false },
            }, { transaction });

            // Создаем обратно tt_models
            await queryInterface.createTable('tt_models', {
                id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
                userId: {
                    type: Sequelize.UUID,
                    allowNull: false,
                    references: { model: 'users', key: 'id' },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                name: { type: Sequelize.STRING, allowNull: false },
                description: { type: Sequelize.TEXT, allowNull: true },
                instruction: { type: Sequelize.TEXT, allowNull: true },
                imagePaths: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
                createdAt: { type: Sequelize.DATE, allowNull: false },
                updatedAt: { type: Sequelize.DATE, allowNull: false },
            }, { transaction });

            // Возвращаем данные обратно
            await queryInterface.sequelize.query(
                `INSERT INTO flux_models (id, "userId", name, description, instruction, "imagePaths", "createdAt", "updatedAt")
                 SELECT id, "userId", name, description, instruction, "imagePaths", "createdAt", "updatedAt"
                 FROM training_models WHERE provider = 'unifically';`,
                { transaction }
            );

            await queryInterface.sequelize.query(
                `INSERT INTO tt_models (id, "userId", name, description, instruction, "imagePaths", "createdAt", "updatedAt")
                 SELECT id, "userId", name, description, instruction, "imagePaths", "createdAt", "updatedAt"
                 FROM training_models WHERE provider = 'ttapi';`,
                { transaction }
            );

            // Удаляем training_models
            await queryInterface.dropTable('training_models', { transaction });

            // Удаляем ENUM тип
            await queryInterface.sequelize.query(
                'DROP TYPE IF EXISTS "enum_training_models_provider";',
                { transaction }
            );

            await transaction.commit();
            console.log('✅ Rollback completed successfully');

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Rollback failed:', error);
            throw error;
        }
    }
};
