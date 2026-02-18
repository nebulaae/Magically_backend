'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`ALTER TYPE "enum_generation_jobs_service" ADD VALUE 'flux';`);
    },

    async down(queryInterface, Sequelize) {
    }
};