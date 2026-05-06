// config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Initialize Sequelize for PostgreSQL
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: false, // Disable query logging to keep the terminal clean
    }
);

module.exports = sequelize;