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

### 2. Seed Images

To populate the database with the default avatar images, run the following command from the web application directory:

```bash
node scripts/seedAvatars.js
```

Run this script before starting the server to ensure the default avatar images are available in the application.

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
