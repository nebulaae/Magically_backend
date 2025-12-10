'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('generation_jobs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      service: {
        type: Sequelize.ENUM('kling', 'higgsfield', 'gpt', 'fal', 'replicate'),
        allowNull: false,
      },
      serviceTaskId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      resultUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      prompt: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Indexes
    await queryInterface.addIndex('generation_jobs', ['userId']);
    await queryInterface.addIndex('generation_jobs', ['serviceTaskId']);
    await queryInterface.addIndex('generation_jobs', ['status']);
    await queryInterface.addIndex('generation_jobs', ['service']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('generation_jobs');
  },
};