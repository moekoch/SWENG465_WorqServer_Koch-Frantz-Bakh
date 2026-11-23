//=================
// load environment
//=================

require('dotenv').config();
const PORT = 3000;

//===================
// configure database
//===================

const { connectDB } = require('./services/database');

//===================
// create express app
//===================

const express = require('express');
const app = express();
app.use(express.json({ limit: '50kb' }));

//===================
// cors configuration
//===================

const cors = require('cors');
app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));

//=====================
// socket configuration
//=====================

const http = require('http');
const { initSocket } = require('./services/socket');

//======================
// swagger configuration
//======================

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Worquarium API',
            version: '1.0.0',
            description: 'API for leveraging Worquarium resources'
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'development server'
            }
        ]
    },
    apis: ['./routes/**/*.js'] // paths to files containing api definitions
};

// generate openapi specification
const specs = swaggerJsdoc(options);

//serve the swagger ui on a specific route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

//=====================
// create API endpoints
//=====================

// every route, and who may call it, is listed in routes/index.js
const { registerRoutes } = require('./routes');
registerRoutes(app);

// a crash in any route answers with JSON instead of an HTML error page
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    if (res.headersSent) return next(error);
    res.status(error.status === 400 || error.type === 'entity.parse.failed' ? 400 : 500).json({
        error: error.type === 'entity.parse.failed' ? 'Invalid JSON.' : 'Server error',
    });
});

//=================
// start the server
//=================
connectDB()
    .then(() => {
        const server = http.createServer(app);
        initSocket(server);
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(`Failed to connect to MongoDB: ${error}`);
    });