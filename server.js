// server.js
require('dotenv').config();
const express = require('express');
const { connectDB } = require('./services/database');
const PORT = 3000;

//===================
// create express app
//===================

const app = express();
app.use(express.json());

const cors = require('cors');
app.use(cors({ origin: 'http://localhost:5173' }));

//======================
// swagger configuration
//======================

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0', // specifies openapi version
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

//=======================
// import route functions
//=======================

// auth checks the login token on protected routes
const { requireAuth } = require('./services/auth');

// avatar
const createAvatar = require('./routes/avatars/createAvatar');
const getAvatar = require('./routes/avatars/getAvatar');
const getAvatars = require('./routes/avatars/getAvatars');
const updateAvatar = require('./routes/avatars/updateAvatar');
const deleteAvatar = require('./routes/avatars/deleteAvatar');

// chat
const createChat = require('./routes/chats/createChat');
const getChat = require('./routes/chats/getChat');
const getChats = require('./routes/chats/getChats');
const updateChat = require('./routes/chats/updateChat');
const deleteChat = require('./routes/chats/deleteChat');

// bot
const createBot = require('./routes/bots/createBot');
const getBots = require('./routes/bots/getBots');

// item
const createItem = require('./routes/items/createItem');
const getItem = require('./routes/items/getItem');
const getItems = require('./routes/items/getItems');
const updateItem = require('./routes/items/updateItem');
const deleteItem = require('./routes/items/deleteItem');

// message
const createMessage = require('./routes/chats/messages/createMessage');
const getMessages = require('./routes/chats/messages/getMessages');
const getMessage = require('./routes/chats/messages/getMessage');
const updateMessage = require('./routes/chats/messages/updateMessage');
const deleteMessage = require('./routes/chats/messages/deleteMessage');

// user
const loginUser = require('./routes/users/loginUser');
const createUser = require('./routes/users/createUser');
const changePassword = require('./routes/users/changePassword');
const getUsers = require('./routes/users/getUsers');
const getUser = require('./routes/users/getUser');
const updateUser = require('./routes/users/updateUser');
const deleteUser = require('./routes/users/deleteUser');

//=====================
// create API endpoints
//=====================

// avatar
app.post('/api/avatars', createAvatar);
app.get('/api/avatars/:id', getAvatar);
app.get('/api/avatars', getAvatars);
app.put('/api/avatars/:id', updateAvatar);
app.delete('/api/avatars/:id', deleteAvatar);

// chat
app.post('/api/chats', createChat);
app.get('/api/chats/:id', getChat);
app.get('/api/chats', getChats);
app.put('/api/chats/:id', updateChat);
app.delete('/api/chats/:id', deleteChat);

// bot
app.post('/api/bots', createBot);
app.get('/api/bots', getBots);

// item
app.post('/api/items', createItem);
app.get('/api/items/:id', getItem);
app.get('/api/items', getItems);
app.put('/api/items/:id', updateItem);
app.delete('/api/items/:id', deleteItem);

// message
app.post('/api/messages', createMessage);
app.get('/api/messages/:id', getMessage);
app.get('/api/messages', getMessage);
app.put('/api/messages/:id', updateMessage);
app.delete('/api/messages/:id', deleteMessage);

// user
app.post('/api/login', loginUser);
app.post('/api/users', createUser);
app.patch('/api/users/me/password', requireAuth, changePassword);
app.get('/api/users', getUsers);
app.get('/api/users/:id', getUser);
app.put('/api/users/:id', updateUser);
app.delete('/api/users/me', requireAuth, deleteUser);

//=================
// start the server
//=================
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(`Failed to connect to MongoDB: ${error}`);
    });