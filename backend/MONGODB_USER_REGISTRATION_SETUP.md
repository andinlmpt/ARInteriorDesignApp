# MongoDB User Registration Setup

## ✅ Configuration Complete

Your user registration is now configured to use MongoDB!

### Database Configuration
- **Database Name:** `ARINTERIORDESIGNAPP`
- **Collection Name:** `users`
- **Connection:** MongoDB Atlas (cluster0.wtbvl5m.mongodb.net)

## What Changed

### 1. Database Name Updated
- Changed from `ar_interior_design` to `ARINTERIORDESIGNAPP`
- Updated in: `backend/src/db/mongodb.js`

### 2. User Registration Now Uses MongoDB
- **Signup endpoint** (`POST /api/v1/users/signup`) now saves users to MongoDB
- **Login endpoint** (`POST /api/v1/users/login`) now authenticates against MongoDB
- **Get user endpoint** (`GET /api/v1/users/me`) now retrieves from MongoDB

### 3. User Model Configuration
- Model name: `User`
- Collection name: `users` (explicitly set)
- Password hashing: Automatic (bcrypt)
- Email: Unique, lowercase, validated
- Timestamps: Automatic (createdAt, updatedAt)

## How It Works

### User Registration Flow

1. **Client sends signup request:**
   ```json
   POST /api/v1/users/signup
   {
     "email": "user@example.com",
     "password": "password123",
     "name": "John Doe"
   }
   ```

2. **Server validates and saves to MongoDB:**
   - Validates email format
   - Checks password length (min 6 characters)
   - Checks if email already exists
   - Hashes password automatically (bcrypt)
   - Saves to `ARINTERIORDESIGNAPP.users` collection

3. **Server responds with user and JWT token:**
   ```json
   {
     "message": "User created successfully",
     "user": {
       "id": "507f1f77bcf86cd799439011",
       "email": "user@example.com",
       "name": "John Doe",
       "createdAt": "2024-01-01T00:00:00.000Z"
     },
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

## Fallback Behavior

If MongoDB is not connected, the system automatically falls back to hardcoded users. This ensures the API continues to work even if MongoDB is unavailable.

## MongoDB Connection

Make sure your MongoDB connection string is set in `.env`:

```env
MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_PASSWORD@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=ARINTERIORDESIGNAPP
```

## Testing

### Test Registration
```bash
curl -X POST http://localhost:3000/api/v1/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Verify in MongoDB

Check your MongoDB Atlas dashboard:
- Database: `ARINTERIORDESIGNAPP`
- Collection: `users`
- You should see registered users with hashed passwords

## User Schema

```javascript
{
  email: String (required, unique, lowercase),
  password: String (required, hashed, min 6 chars),
  name: String (optional),
  apiKey: String (optional, unique),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

## Security Features

✅ **Password Hashing:** Automatic bcrypt hashing (cost: 10)  
✅ **Email Validation:** Regex pattern validation  
✅ **Unique Email:** Database-level uniqueness constraint  
✅ **Password Exclusion:** Password never returned in API responses  
✅ **JWT Authentication:** Secure token-based auth  

## Next Steps

1. **Set MongoDB password** in `.env` file (replace `<db_password>`)
2. **Restart server** to apply changes
3. **Test registration** using the API endpoints
4. **Verify in MongoDB Atlas** that users are being saved

Your user registration is now fully integrated with MongoDB! 🎉
