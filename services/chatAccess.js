const { getDB } = require('./database');
const { toObjectId } = require('./http');

// Who may open a chat: anyone for a public room, only the people in it for direct and group chats.
// Resolves to { chat } or { status, error } so a route can answer straight away.
async function getAccessibleChat(user, chatIdText) {
    const chatId = toObjectId(chatIdText);
    if (!chatId) return { status: 400, error: 'Invalid chat ID.' };

    const chat = await getDB().collection('chats').findOne({ _id: chatId });
    if (!chat) return { status: 404, error: 'Chat not found.' };

    if (chat.type === 'room') return { chat };
    const isMember = (chat.participants ?? []).some((id) => String(id) === String(user._id));
    // outsiders are told the chat doesn't exist, so private chats can't be found by guessing ids
    if (!isMember) return { status: 404, error: 'Chat not found.' };
    return { chat };
}

// what a message looks like to the app
function publicMessage(message, { staff = false } = {}) {
    return {
        _id: message._id,
        chatID: message.chatID,
        userID: message.userID,
        username: message.username,
        body: message.removedAt && !staff ? '' : message.body,
        sentAt: message.sentAt,
        ...(message.editedAt && { editedAt: message.editedAt }),
        ...(staff && message.removedAt && { removed: true, removedAt: message.removedAt }),
    };
}

module.exports = { getAccessibleChat, publicMessage };
