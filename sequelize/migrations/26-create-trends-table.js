'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // 1. Создаём таблицу trends
            await queryInterface.createTable(
                'trends',
                {
                    id: {
                        type: Sequelize.UUID,
                        defaultValue: Sequelize.UUIDV4,
                        primaryKey: true,
                    },
                    content: {
                        type: Sequelize.TEXT,
                        allowNull: false,
                    },
                    coverText: {
                        type: Sequelize.STRING,
                        allowNull: true,
                    },
                    trendingCover: {
                        type: Sequelize.STRING,
                        allowNull: true,
                    },
                    trendingImageSet: {
                        type: Sequelize.JSONB,
                        allowNull: true,
                        defaultValue: [],
                    },
                    adminId: {
                        type: Sequelize.UUID,
                        allowNull: true,
                        references: { model: 'Admins', key: 'id' },
                        onUpdate: 'CASCADE',
                        onDelete: 'SET NULL',
                    },
                    createdAt: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                    updatedAt: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                },
                { transaction }
            );

            await queryInterface.addIndex('trends', ['adminId'], { transaction });

            // 2. Мигрируем существующие тренды из publications в trends
            await queryInterface.sequelize.query(
                `INSERT INTO trends (id, content, "coverText", "trendingCover", "trendingImageSet", "adminId", "createdAt", "updatedAt")
         SELECT id, content, "coverText", "trendingCover", "trendingImageSet", "adminId", "createdAt", "updatedAt"
         FROM publications
         WHERE "isTrend" = true;`,
                { transaction }
            );

            // 3. Удаляем тренды из publications
            await queryInterface.sequelize.query(
                `DELETE FROM publications WHERE "isTrend" = true;`,
                { transaction }
            );

            // 4. Удаляем поля тренда из publications
            const tableDescription = await queryInterface.describeTable('publications');

            if (tableDescription['trendingCover']) {
                await queryInterface.removeColumn('publications', 'trendingCover', { transaction });
            }
            if (tableDescription['trendingImageSet']) {
                await queryInterface.removeColumn('publications', 'trendingImageSet', { transaction });
            }
            if (tableDescription['coverText']) {
                await queryInterface.removeColumn('publications', 'coverText', { transaction });
            }
            if (tableDescription['isTrend']) {
                await queryInterface.removeColumn('publications', 'isTrend', { transaction });
            }

            await transaction.commit();
            console.log('✅ Migration 26: trends table created, fields removed from publications');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Migration 26 failed:', error);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Возвращаем поля в publications
            await queryInterface.addColumn(
                'publications',
                'isTrend',
                { type: Sequelize.BOOLEAN, defaultValue: false },
                { transaction }
            );
            await queryInterface.addColumn(
                'publications',
                'trendingCover',
                { type: Sequelize.STRING, allowNull: true },
                { transaction }
            );
            await queryInterface.addColumn(
                'publications',
                'trendingImageSet',
                { type: Sequelize.JSONB, allowNull: true },
                { transaction }
            );
            await queryInterface.addColumn(
                'publications',
                'coverText',
                { type: Sequelize.STRING, allowNull: true },
                { transaction }
            );

            // Мигрируем данные обратно
            await queryInterface.sequelize.query(
                `INSERT INTO publications (id, content, "coverText", "trendingCover", "trendingImageSet", "adminId", "isTrend", "userId", "likeCount", "commentCount", "createdAt", "updatedAt")
         SELECT id, content, "coverText", "trendingCover", "trendingImageSet", "adminId", true, null, 0, 0, "createdAt", "updatedAt"
         FROM trends;`,
                { transaction }
            );

            // Удаляем таблицу trends
            await queryInterface.dropTable('trends', { transaction });

            await transaction.commit();
            console.log('✅ Migration 26 rolled back');
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Migration 26 rollback failed:', error);
            throw error;
        }
    },
};