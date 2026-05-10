// models/Ticket.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ticket = sequelize.define('Ticket', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    attendeeName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true,
        }
    },
    isScanned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false, // This flag ensures the QR code can only be scanned once
    },
    paymentStatus: {
        type: DataTypes.STRING,
        defaultValue: 'completed', // Assuming ticket is only created after successful payment
    },

    status: {
        type: DataTypes.STRING,
        defaultValue: 'VALID' // Par défaut on considère le pass comme valide
    }

}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
});

module.exports = Ticket;