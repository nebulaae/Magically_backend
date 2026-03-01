'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Делаем userId необязательным, так как тренды создает админ (у них adminId)
        await queryInterface.changeColumn('publications', 'userId', {
            type: Sequelize.UUID,
            allowNull: true,
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn('publications', 'userId', {
            type: Sequelize.UUID,
            allowNull: false,
        });
    }
};