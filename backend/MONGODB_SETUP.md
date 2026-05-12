# MongoDB Setup Guide

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://miguelraule14_db_user:ySTPsBZXb4tjO0AO@cluster0.da81dtx.mongodb.net/
MONGODB_DB_NAME=ar_interior_design

# JWT Secret (change this in production!)
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

## Installation

Install the required dependencies:

```bash
cd backend
npm install
```

## API Endpoints

### Sign Up
**POST** `/api/v1/users/signup`

Request body:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe" // optional
}
```

Response:
```json
{
  "message": "User created successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt_token_here"
}
```

### Login
**POST** `/api/v1/users/login`

Request body:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "message": "Login successful",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "jwt_token_here"
}
```

### Get Current User
**GET** `/api/v1/users/me`

Headers:
```
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

Alternatively, you can use the `X-API-Key` header for backward compatibility with API keys.

## Testing

You can test the endpoints using curl or any HTTP client:

```bash
# Sign up
curl -X POST http://localhost:3000/api/v1/users/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get current user (replace TOKEN with actual token)
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer TOKEN"
```
