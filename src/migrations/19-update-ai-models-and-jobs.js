module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Поле для управления системным промптом в модели
        await queryInterface.addColumn('training_models', 'isSystemPromptEnabled', {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        });

        // 2. Поля для цен в таблицу настроек (Settings)
        await queryInterface.addColumn('settings', 'aiCost1K', {
            type: Sequelize.INTEGER,
            defaultValue: 15,
        });
        await queryInterface.addColumn('settings', 'aiCost2K', {
            type: Sequelize.INTEGER,
            defaultValue: 20,
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('training_models', 'isSystemPromptEnabled');
        await queryInterface.removeColumn('settings', 'aiCost1K');
        await queryInterface.removeColumn('settings', 'aiCost2K');
    }
};