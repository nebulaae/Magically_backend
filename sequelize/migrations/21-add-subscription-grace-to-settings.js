'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('settings');
    if (!tableInfo.subscriptionGracePeriodDays) {
      await queryInterface.addColumn('settings', 'subscriptionGracePeriodDays', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('settings', 'subscriptionGracePeriodDays');
  },
};

