# Create .env File for MongoDB Connection

## Quick Setup

### Step 1: Create the `.env` file

In the `backend` directory, create a file named `.env` (no extension, just `.env`)

### Step 2: Add this content (replace YOUR_PASSWORD_HERE)

```env
# MongoDB Connection
# IMPORTANT: Replace YOUR_PASSWORD_HERE with your actual MongoDB password
MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_PASSWORD_HERE@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=ARINTERIORDESIGNAPP

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006

# JWT Secret (change this in production!)
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

### Step 3: Replace the password

Replace `YOUR_PASSWORD_HERE` with your actual MongoDB password.

**If your password has special characters, URL-encode them:**
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

### Step 4: Whitelist Your IP in MongoDB Atlas

1. Go to: https://cloud.mongodb.com/
2. Log in to your MongoDB Atlas account
3. Select your cluster
4. Click **Network Access** (left sidebar)
5. Click **Add IP Address**
6. Click **Allow Access from Anywhere** (for development) or add your specific IP
7. Wait 1-2 minutes

### Step 5: Restart Server

```powershell
# Stop current server (Ctrl+C)
cd backend
npm start
```

## Expected Output

After fixing, you should see:
```
[MongoDB] ✅ Connected successfully
[MongoDB] Database: ARINTERIORDESIGNAPP
```

## Troubleshooting

If you still get connection errors:

1. **Verify password is correct** - Check MongoDB Atlas → Database Access
2. **Check IP whitelist** - Make sure your IP is allowed
3. **Check cluster status** - Make sure cluster is not paused
4. **Try from MongoDB Compass** - Test the connection string there first

## Example .env File

Here's what a complete `.env` file should look like (with a sample password):

```env
MONGODB_URI=mongodb+srv://shilapuk_db_user:MyPassword123@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=ARINTERIORDESIGNAPP
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

**Remember:** Never commit this file to git! It's already in `.gitignore`.
