'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const table = await queryInterface.describeTable('Settings');
        if (!table.aiCost1K) {
            await queryInterface.addColumn('Settings', 'aiCost1K', {
                type: Sequelize.INTEGER,
                defaultValue: 15,
            });
        }
        if (!table.aiCost2K) {
            await queryInterface.addColumn('Settings', 'aiCost2K', {
                type: Sequelize.INTEGER,
                defaultValue: 20,
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('Settings', 'aiCost1K');
        await queryInterface.removeColumn('Settings', 'aiCost2K');
    }
};