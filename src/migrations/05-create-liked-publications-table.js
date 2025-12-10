'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('liked_publications', {
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      publicationId: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: {
          model: 'publications',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });

    // Indexes
    await queryInterface.addIndex('liked_publications', ['userId']);
    await queryInterface.addIndex('liked_publications', ['publicationId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('liked_publications');
  },
};