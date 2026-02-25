'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('settings');
    if (!tableInfo.trialTokens) {
      await queryInterface.addColumn('settings', 'trialTokens', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 50,
      });
    }
    if (!tableInfo.trialPeriodDays) {
      await queryInterface.addColumn('settings', 'trialPeriodDays', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 7,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('settings', 'trialTokens');
    await queryInterface.removeColumn('settings', 'trialPeriodDays');
  },
};
