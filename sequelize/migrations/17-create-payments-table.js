'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Создаем таблицу payments
    await queryInterface.createTable('payments', {
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
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'RUB',
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      paymentMethod: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      paymentProvider: {
        type: Sequelize.ENUM('bepaid'),
        allowNull: true,
      },
      externalPaymentId: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      paymentToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      redirectUrl: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
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

    // Добавляем индексы для оптимизации запросов
    await queryInterface.addIndex('payments', ['userId']);
    await queryInterface.addIndex('payments', ['status']);
    await queryInterface.addIndex('payments', ['externalPaymentId']);
  },

  async down(queryInterface, Sequelize) {
    // Удаляем таблицу (индексы и ENUM типы удалятся автоматически)
    await queryInterface.dropTable('payments');
  },
};
