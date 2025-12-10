'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('liked_comments', {
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
      commentId: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: {
          model: 'comments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });

    // Indexes
    await queryInterface.addIndex('liked_comments', ['userId']);
    await queryInterface.addIndex('liked_comments', ['commentId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('liked_comments');
  },
};