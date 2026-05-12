# Hardcoded Users for Login

This system uses hardcoded users for testing authentication without requiring MongoDB.

## Available Test Users

### Admin User
- **Email:** `admin@example.com`
- **Password:** `admin123`
- **Name:** Admin User
- **Role:** admin

### Test User
- **Email:** `user@example.com`
- **Password:** `user123`
- **Name:** Test User
- **Role:** user

### John Doe
- **Email:** `john@example.com`
- **Password:** `password123`
- **Name:** John Doe
- **Role:** user

### Jane Smith
- **Email:** `jane@example.com`
- **Password:** `password123`
- **Name:** Jane Smith
- **Role:** user

## API Endpoints

### Login
```bash
POST /api/v1/users/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "1",
    "email": "admin@example.com",
    "name": "Admin User",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Sign Up
```bash
POST /api/v1/users/signup
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User"
}
```

### Get Current User
```bash
GET /api/v1/users/me
Authorization: Bearer <token>
```

## Testing with cURL

```bash
# Login
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Get current user (replace TOKEN with token from login)
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer TOKEN"
```

## Notes

- These users work **without MongoDB** - no database setup required!
- Passwords are stored in memory (not secure for production)
- New users can be created via signup endpoint
- JWT tokens work with or without the `jsonwebtoken` package installed
- Perfect for testing when npm packages can't be installed

## Switching to MongoDB

When you're ready to use MongoDB:
1. Install npm packages: `npm install mongoose bcryptjs jsonwebtoken`
2. Update `backend/src/routes/users.js` to use `User` model instead of hardcoded users
3. Update `backend/src/middleware/auth.js` to use MongoDB queries
