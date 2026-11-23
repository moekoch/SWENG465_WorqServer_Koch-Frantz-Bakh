// Every API endpoint in one place. Read top to bottom: who can call it is on each line.
//   public            anyone
//   requireAuth       any logged-in user
//   moderator / admin requireAuth + requireRole(...)
const { requireAuth, requireRole } = require('../services/auth');

const asModerator = [requireAuth, requireRole('moderator')];
const asAdmin = [requireAuth, requireRole('admin')];

function registerRoutes(app) {
    //=======
    // users
    //=======
    app.post('/api/login', require('./users/loginUser'));
    app.post('/api/users', require('./users/createUser'));
    app.get('/api/users', requireAuth, require('./users/getUsers'));

    // the logged-in user (these come before /api/users/:id so "me" is not taken as an id)
    app.get('/api/users/me', requireAuth, require('./users/getMe'));
    app.patch('/api/users/me', requireAuth, require('./users/updateMe'));
    app.delete('/api/users/me', requireAuth, require('./users/deleteUser'));
    app.patch('/api/users/me/password', requireAuth, require('./users/changePassword'));
    app.patch('/api/users/me/avatar', requireAuth, require('./users/setMyAvatar'));
    app.get('/api/users/me/friends', requireAuth, require('./friends/getMyFriends'));
    app.get('/api/users/me/mute', requireAuth, require('./moderation/mutes/getMyMute'));

    // settings
    app.get('/api/users/me/settings', requireAuth, require('./users/settings/getSettings'));
    app.put('/api/users/me/settings', requireAuth, require('./users/settings/putSettings'));
    app.patch('/api/users/me/settings', requireAuth, require('./users/settings/patchSettings'));
    app.delete('/api/users/me/settings', requireAuth, require('./users/settings/deleteSettings'));

    // tank
    app.get('/api/users/me/tank', requireAuth, require('./users/tank/getTank'));
    app.put('/api/users/me/tank', requireAuth, require('./users/tank/putTank'));
    app.patch('/api/users/me/tank', requireAuth, require('./users/tank/patchTank'));
    app.delete('/api/users/me/tank', requireAuth, require('./users/tank/deleteTank'));
    app.get('/api/users/:id/tank', requireAuth, require('./users/tank/getUserTank'));

    // other users
    app.get('/api/users/:id', requireAuth, require('./users/getUser'));
    app.put('/api/users/:id', requireAuth, require('./users/updateUser'));
    app.delete('/api/users/:id', ...asAdmin, require('./users/deleteUserById'));
    app.patch('/api/users/:id/status', ...asModerator, require('./users/setUserStatus'));
    app.patch('/api/users/:id/role', ...asAdmin, require('./users/setUserRole'));

    //==========
    // friends
    //==========
    app.post('/api/friends', requireAuth, require('./friends/createFriend'));
    app.get('/api/friends', requireAuth, require('./friends/getFriends'));
    app.get('/api/friends/:id', requireAuth, require('./friends/getFriend'));
    app.patch('/api/friends/:id', requireAuth, require('./friends/updateFriend'));
    app.put('/api/friends/:id', requireAuth, require('./friends/updateFriend'));
    app.delete('/api/friends/:id', requireAuth, require('./friends/deleteFriend'));

    // blocks
    app.post('/api/blocks', requireAuth, require('./users/blocks/createBlock'));
    app.get('/api/blocks', requireAuth, require('./users/blocks/getBlocks'));
    app.delete('/api/blocks/:userId', requireAuth, require('./users/blocks/deleteBlock'));

    // invites
    app.post('/api/invites', requireAuth, require('./invites/createInvite'));
    app.get('/api/invites', requireAuth, require('./invites/getInvites'));
    app.get('/api/invites/:id', requireAuth, require('./invites/getInvite'));
    app.patch('/api/invites/:id', requireAuth, require('./invites/updateInvite'));
    app.put('/api/invites/:id', requireAuth, require('./invites/updateInvite'));
    app.delete('/api/invites/:id', requireAuth, require('./invites/deleteInvite'));

    //=======
    // chat
    //=======
    app.post('/api/chats', requireAuth, require('./chats/createChat'));
    app.get('/api/chats', requireAuth, require('./chats/getChats'));
    app.get('/api/chats/:id', requireAuth, require('./chats/getChat'));
    app.put('/api/chats/:id', requireAuth, require('./chats/updateChat'));
    app.patch('/api/chats/:id', requireAuth, require('./chats/updateChat'));
    app.delete('/api/chats/:id', requireAuth, require('./chats/deleteChat'));

    // messages (the chat id is part of the address)
    app.post('/api/chats/:chatID/messages', requireAuth, require('./chats/messages/createMessage'));
    app.get('/api/chats/:chatID/messages', requireAuth, require('./chats/messages/getMessages'));
    app.get('/api/chats/:chatID/messages/:messageID', requireAuth, require('./chats/messages/getMessage'));
    app.put('/api/chats/:chatID/messages/:messageID', requireAuth, require('./chats/messages/updateMessage'));
    app.delete('/api/chats/:chatID/messages/:messageID', requireAuth, require('./chats/messages/deleteMessage'));

    //============
    // moderation
    //============
    app.post('/api/moderation/check', requireAuth, require('./moderation/checkText'));

    app.post('/api/reports', requireAuth, require('./moderation/reports/createReport'));
    app.get('/api/reports', requireAuth, require('./moderation/reports/getReports'));
    app.get('/api/reports/:id', requireAuth, require('./moderation/reports/getReport'));
    app.patch('/api/reports/:id', ...asModerator, require('./moderation/reports/updateReport'));
    app.delete('/api/reports/:id', ...asAdmin, require('./moderation/reports/deleteReport'));

    app.post('/api/moderation/mutes', ...asModerator, require('./moderation/mutes/createMute'));
    app.get('/api/moderation/mutes', ...asModerator, require('./moderation/mutes/getMutes'));
    app.get('/api/moderation/mutes/:id', ...asModerator, require('./moderation/mutes/getMute'));
    app.patch('/api/moderation/mutes/:id', ...asModerator, require('./moderation/mutes/updateMute'));
    app.delete('/api/moderation/mutes/:id', ...asModerator, require('./moderation/mutes/deleteMute'));

    app.get('/api/moderation/logs', ...asModerator, require('./moderation/logs/getLogs'));
    app.get('/api/moderation/logs/:id', ...asModerator, require('./moderation/logs/getLog'));
    app.delete('/api/moderation/logs/:id', ...asAdmin, require('./moderation/logs/deleteLog'));

    app.post('/api/moderation/terms', ...asAdmin, require('./moderation/terms/createTerm'));
    app.get('/api/moderation/terms', ...asModerator, require('./moderation/terms/getTerms'));
    app.put('/api/moderation/terms/:id', ...asAdmin, require('./moderation/terms/updateTerm'));
    app.delete('/api/moderation/terms/:id', ...asAdmin, require('./moderation/terms/deleteTerm'));

    //===========
    // sessions
    //===========
    app.get('/api/sessions', require('./sessions/getSessions'));
    app.get('/api/sessions/:id', require('./sessions/getSession'));
    app.post('/api/sessions', ...asModerator, require('./sessions/createSession'));
    app.put('/api/sessions/:id', ...asModerator, require('./sessions/updateSession'));
    app.patch('/api/sessions/:id', ...asModerator, require('./sessions/updateSession'));
    app.delete('/api/sessions/:id', ...asAdmin, require('./sessions/deleteSession'));

    //=======
    // shop
    //=======
    app.get('/api/avatars', require('./avatars/getAvatars'));
    app.get('/api/avatars/:id', require('./avatars/getAvatar'));
    app.post('/api/avatars', ...asAdmin, require('./avatars/createAvatar'));
    app.put('/api/avatars/:id', ...asAdmin, require('./avatars/updateAvatar'));
    app.post('/api/avatars/:id/purchase', requireAuth, require('./avatars/purchaseAvatar'));
    app.delete('/api/avatars/:id', ...asAdmin, require('./avatars/deleteAvatar'));

    app.get('/api/items', require('./items/getItems'));
    app.get('/api/items/:id', require('./items/getItem'));
    app.post('/api/items', ...asAdmin, require('./items/createItem'));
    app.put('/api/items/:id', ...asAdmin, require('./items/updateItem'));
    app.post('/api/items/:id/purchase', requireAuth, require('./items/purchaseItem'));
    app.delete('/api/items/:id', ...asAdmin, require('./items/deleteItem'));

    //=======
    // games
    //=======
    app.get('/api/bots', require('./bots/getBots'));
    app.get('/api/bots/:id', require('./bots/getBot'));
    app.post('/api/bots', ...asAdmin, require('./bots/createBot'));
    app.put('/api/bots/:id', ...asAdmin, require('./bots/updateBot'));
    app.delete('/api/bots/:id', ...asAdmin, require('./bots/deleteBot'));

    app.post('/api/games/results', requireAuth, require('./games/results/createResult'));
    app.get('/api/games/results', requireAuth, require('./games/results/getResults'));
    app.get('/api/games/results/:id', requireAuth, require('./games/results/getResult'));
    app.put('/api/games/results/:id', ...asModerator, require('./games/results/updateResult'));
    app.delete('/api/games/results/:id', requireAuth, require('./games/results/deleteResult'));

    // scores (the fixed words come before :id)
    app.get('/api/games/scores/me', requireAuth, require('./games/scores/getUserScore'));
    app.get('/api/games/scores/bots', requireAuth, require('./games/scores/getBotScore'));
    app.get('/api/games/scores/friends', requireAuth, require('./games/scores/getFriendScore'));
    app.get('/api/games/scores/users/:id', requireAuth, require('./games/scores/getUserScore'));

    // anything else under /api is a clean JSON 404
    app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
}

module.exports = { registerRoutes };
