'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      icon: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM('package', 'subscription', 'topup'),
        allowNull: false,
      },
      tokenAmount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      periodDays: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'RUB',
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.addIndex('plans', ['type']);
    await queryInterface.addIndex('plans', ['isActive']);

    await queryInterface.createTable('user_plans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      planId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'plans', key: 'id' },
      },
      status: {
        type: Sequelize.ENUM(
          'trial',
          'active',
          'overdue',
          'cancelled',
          'expired',
          'noplan'
        ),
        allowNull: false,
      },
      startDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      tokensFromPlan: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tokensFromTopup: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      autoRenew: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      gracePeriodEnd: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
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
    await queryInterface.addIndex('user_plans', ['userId']);
    await queryInterface.addIndex('user_plans', ['planId']);
    await queryInterface.addIndex('user_plans', ['status']);
    await queryInterface.addIndex('user_plans', ['endDate']);
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX user_plans_one_active_per_user ON user_plans ("userId") WHERE status IN ('trial', 'active', 'overdue', 'cancelled')`
    );

    await queryInterface.createTable('topups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userPlanId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'user_plans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tokenAmount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'RUB',
      },
      paymentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'payments', key: 'id' },
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('topups', ['userId']);
    await queryInterface.addIndex('topups', ['userPlanId']);
    await queryInterface.addIndex('topups', ['paymentId']);
    await queryInterface.addIndex('topups', ['expiresAt']);

    await queryInterface.addColumn('users', 'hasUsedTrial', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'hasUsedTrial');
    await queryInterface.dropTable('topups');
    await queryInterface.dropTable('user_plans');
    await queryInterface.dropTable('plans');
  },
};
