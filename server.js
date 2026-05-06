// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const sequelize = require('./config/database');
const Ticket = require('./models/Ticket');
const ticketController = require('./controllers/ticketController');

const app = express();

// Secure the app by setting various HTTP headers
app.use(helmet());

// Rate limiting setup (Anti-DDoS and Anti-Spam)
// Limit each IP to 100 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: "TROP DE REQUÊTES. VEUILLEZ PATIENTER."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply the rate limiter to all API routes
app.use('/api/', apiLimiter);

// Configure CORS for production to only allow specific domains
const corsOptions = {
    // Allow localhost for development, and your future domain for production
    origin: [
        'http://localhost:5173',
        'https://localhost:5173',
        // 'https://www.your-domain.com', // TODO: Uncomment and add your Hostinger domain here
        // 'https://your-domain.com'
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply the strict CORS configuration
app.use(cors(corsOptions));

// Parse incoming JSON requests
app.use(express.json());

// Routes
app.post('/api/tickets/purchase', ticketController.createTicket);
app.post('/api/tickets/verify', ticketController.verifyTicket);

// Database Sync and Server Initialization
// Defaulting to 8080 as configured in your frontend requests
const PORT = process.env.PORT || 8080;

const startServer = async () => {
    try {
        // Authenticate the database connection
        await sequelize.authenticate();
        console.log('PostgreSQL connected successfully.');

        // Sync models to the database (creates tables if they do not exist)
        await sequelize.sync({ alter: true });
        console.log('Database synced.');

        // Start the Express server
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

startServer();