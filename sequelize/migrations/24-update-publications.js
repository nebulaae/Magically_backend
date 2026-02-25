'use strict'

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Publications', 'isPhotoOfTheDay');
        await queryInterface.addColumn('Publications', 'isTrend', { type: Sequelize.BOOLEAN, defaultValue: false });
        await queryInterface.addColumn('Publications', 'trendingCover', { type: Sequelize.STRING, allowNull: true });
        await queryInterface.addColumn('Publications', 'trendingImageSet', { type: Sequelize.JSONB, allowNull: true });
        await queryInterface.addColumn('Publications', 'coverText', { type: Sequelize.STRING, allowNull: true });
        // Чтобы админ мог создавать публикации:
        await queryInterface.addColumn('Publications', 'adminId', {
            type: Sequelize.UUID,
            references: { model: 'Admins', key: 'id' },
            allowNull: true
        });
    }
};