# 🐠🐠🐠 Worquarium API - Swagger & Postman Setup

## Setup

### 1. Configure Environment Variables

In the web application directory, create a `.env` file using the provided `.env.example` as a template.

```bash
cp .env.example .env
```

Configure the required environment variables in `.env`:

```env
MONGODB_URI=mongodb+srv://<db_username>:<db_password>@worqcluster.xdkdjdc.mongodb.net/?appName=WorqCluster
JWT_SECRET=<secret>
```

- **`MONGODB_URI`** — Replace `<db_username>` and `<db_password>` with your MongoDB database credentials. Ensure your IP address is permitted by the MongoDB Atlas network access settings.
- **`JWT_SECRET`** — Generate a secure secret using Node.js:

  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

  Copy the generated value into `.env` in place of `<secret>`.

> **Note:** Never commit `.env` or expose your database credentials or JWT secret. Keep `.env.example` as a template without real credentials.

### 3. Install Dependencies and Start the Server

In a separate terminal, navigate to the web application directory and run:

```bash
npm install
node server.js
```

The API will run at:

```text
http://localhost:3000
```

> **Important:** Keep the backend server running while using the web application so API requests and authentication can function correctly.

<br>

## Swagger Documentation

Once the server is running, view the API documentation at:

```text
http://localhost:3000/api-docs
```

Swagger provides the available endpoints, request parameters, request bodies, and response formats.

## Postman Testing

Use **Postman** to test the API endpoints.

Import the provided Swagger/OpenAPI definition into Postman to create a collection of the available endpoints.

For local testing, use:

```text
http://localhost:3000
```

For routes containing `{id}`, replace it with the actual resource ID. For example:

```text
GET /api/avatars/{id}
```

becomes:

```text
GET http://localhost:3000/api/avatars/123
```

Keep `node server.js` running while testing requests in Postman.

## Go Fish multiplayer

The authenticated Socket.IO server provides Go Fish matchmaking. Clients join
the queue with `gofish:queue:join` and receive `gofish:lobby` updates containing
other available players. A client starts a match for both queued players by
emitting `gofish:player:select` with `{ playerId }`. The server validates that
both players are still queued, then sends each player their private
`gofish:state`. Game actions use `gofish:ask`; clients can leave the queue or
forfeit an active match with `gofish:leave`.

## Seed Images

To populate the database with avatar images, run:

```bash
node scripts/seedAvatars.js
```

To populate the database with items images, run:

```bash
node scripts/seedItems.js
```

---

## API overview

Every endpoint is listed in one file, `routes/index.js`, with who may call it. Interactive docs are at `/api-docs` when the server runs. Send the token from `POST /api/login` as `Authorization: Bearer <token>`.

| Area | Endpoints |
| --- | --- |
| Users | `POST /api/users` register, `POST /api/login`, `GET /api/users` search, `GET/PUT/DELETE /api/users/:id`, `GET/PATCH/DELETE /api/users/me`, `PATCH /api/users/me/password`, `PATCH /api/users/me/avatar` |
| Settings | `GET/PUT/PATCH/DELETE /api/users/me/settings` |
| Tank | `GET/PUT/PATCH/DELETE /api/users/me/tank`, `GET /api/users/:id/tank` (visit, follows the owner's "tank visitors" setting) |
| Friends | `POST/GET /api/friends`, `GET/PATCH/DELETE /api/friends/:id`, `GET /api/users/me/friends` (accepted friends with `online`) |
| Blocks | `POST/GET /api/blocks`, `DELETE /api/blocks/:userId` |
| Invites | `POST/GET /api/invites`, `GET/PATCH/DELETE /api/invites/:id` |
| Chats | `POST/GET /api/chats`, `GET/PUT/DELETE /api/chats/:id` |
| Messages | `POST/GET /api/chats/:chatID/messages`, `GET/PUT/DELETE /api/chats/:chatID/messages/:messageID` |
| Moderation | `POST /api/moderation/check`, reports `/api/reports`, chat breaks `/api/moderation/mutes`, blocked-message log `/api/moderation/logs`, word list `/api/moderation/terms`, `PATCH /api/users/:id/status`, `PATCH /api/users/:id/role`, `GET /api/users/me/mute` |
| Sessions | `GET/POST /api/sessions`, `GET/PUT/DELETE /api/sessions/:id` (id or slug) |
| Shop | avatars and items: `GET`, `POST`, `PUT`, `DELETE`, `POST .../purchase` |
| Bots | `GET/POST /api/bots`, `GET/PUT/DELETE /api/bots/:id` |
| Games | results `/api/games/results`, scores `/api/games/scores/me`, `/bots`, `/friends`, `/users/:id` |

Live events (socket.io, connect with `auth: { token }`):

| Event | Direction | What it is |
| --- | --- | --- |
| `session:join` / `session:leave` / `move` | client to server | Join the room, leave it, swim |
| `chat:send` `{ text }` | client to server | Say something. The reply (acknowledgement) is `{ ok: true, messageId }` or `{ ok: false, code, error, until? }` |
| `chat:message` `{ id, messageId, username, text, at }` | server to client | A message from someone in the room |
| `chat:private` `{ chatId, message }` | server to client | A new message in a direct or group chat |
| `moderation:muted` / `moderation:unmuted` / `moderation:warning` | server to client | Chat break started or ended, or a warning from a moderator |
| `friend:request` / `friend:accepted` / `friend:removed` / `friend:presence` | server to client | Friends changes, and a friend coming online or going offline |
| `invite:received` / `invite:updated` / `invite:withdrawn` | server to client | Invites |

## Roles

Everyone starts as a `user`. `moderator` can review reports, start and end chat breaks, remove messages, read the blocked-message log, suspend accounts and create rooms. `admin` can also ban, manage the word list, change roles, delete accounts and edit the shop and bots. Make the first admin with:

```
node scripts/setRole.js <username> admin
```

After that, admins can make others moderators with `PATCH /api/users/:id/role`.

## Chat moderation

Every chat message (live or through the API), username, room name, group name and invite note goes through the same filter before anyone sees it (`services/moderation.js`).

**What is blocked**

- Swearing and sexual words, including common disguises: `f*ck`, `f.u.c.k`, `f u c k`, `sh1t`, `fuuuuck`, accents and look-alike letters, invisible characters. Words like "class" and "Scunthorpe" are not caught by mistake.
- Hate speech: slurs, and phrases that target groups of people (violent wishes, "X are subhuman", hate slogans).
- Threats, bullying, and telling someone to hurt themselves.
- Personal information and links: emails, phone numbers, web addresses, "add me on ..." and questions like "what is your address".
- Spam: the same word again and again. Shouting and stretched letters are not blocked, they are tidied ("HELLO EVERYONE" becomes "Hello everyone").

A blocked message is never saved or shown to anyone. The sender gets a friendly reason that never repeats the blocked word.

**Strikes and chat breaks.** Each blocked message adds strikes for 30 minutes (hate speech and threats count 3, other problems 1, spam 0). 3 strikes start a 5 minute chat break, 6 start 30 minutes, 10 start 24 hours. Moderators are filtered but never put on a break. Serious messages (hate speech, threats, encouraging self-harm) also appear in the moderators' report queue straight away.

**Other protections.** Slow mode (one message every 0.7 seconds, and no repeating yourself), 120 character limit in rooms (300 in private chats), people can ignore (block) anyone and never see their chat, and anyone can report a message. Moderators can remove messages, end or start chat breaks, and suspend or ban accounts. Blocked messages are kept in the log for 90 days, then deleted automatically.

**Adjusting the filter.** Admins can add words to block or allow with `/api/moderation/terms` and it takes effect immediately. The severity of each kind of problem and the phrase rules are in `services/moderationLists.js`.

A word filter can never be perfect. It will miss some creative spellings and may block an innocent message now and then, which is why reporting, chat breaks and moderator tools are part of it. Review the log and reports regularly and add words as you see patterns.

## Tests

```
npm test
```

Runs the filter tests and then runs every route and the live chat against an in-memory copy of the database (`test/helpers/fakeDb.js`), so no MongoDB connection is needed.
