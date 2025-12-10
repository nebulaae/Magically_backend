'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      fullname: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      username: {
        type: Sequelize.STRING(16),
        allowNull: true,
        unique: true,
      },
      email: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      bio: {
        type: Sequelize.STRING(72),
        allowNull: true,
      },
      password: {
        type: Sequelize.STRING(60),
        allowNull: true,
      },
      avatar: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      interests: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: [],
      },
      tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 500,
      },
      dailyActions: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: { count: 0, lastReset: new Date() },
      },
      role: {
        type: Sequelize.ENUM('user', 'admin'),
        defaultValue: 'user',
        allowNull: false,
      },
      isBlocked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      otp: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      otpExpires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      passwordResetToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      passwordResetTokenExpires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      replicateModels: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
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

    // Indexes for performance
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['username']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('users');
  },
};