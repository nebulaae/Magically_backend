'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Добавляем новое поле meta
        await queryInterface.addColumn('generation_jobs', 'meta', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
        });

        // Переносим данные из prompt в meta
        await queryInterface.sequelize.query(`
      UPDATE generation_jobs 
      SET meta = jsonb_build_object('prompt', prompt)
      WHERE prompt IS NOT NULL;
    `);

        // Удаляем старое поле prompt
        await queryInterface.removeColumn('generation_jobs', 'prompt');
    },

    async down(queryInterface, Sequelize) {
        // Восстанавливаем поле prompt
        await queryInterface.addColumn('generation_jobs', 'prompt', {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        // Переносим данные обратно
        await queryInterface.sequelize.query(`
      UPDATE generation_jobs 
      SET prompt = meta->>'prompt'
      WHERE meta->>'prompt' IS NOT NULL;
    `);

        // Удаляем поле meta
        await queryInterface.removeColumn('generation_jobs', 'meta');
    },
};