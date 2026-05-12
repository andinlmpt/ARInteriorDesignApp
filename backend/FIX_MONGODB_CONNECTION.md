# Fix MongoDB Connection Error

## Current Error
```
[MongoDB] ❌ Connection error: querySrv ECONNREFUSED _mongodb._tcp.cluster0.wtbvl5m.mongodb.net
```

## Common Causes & Solutions

### 1. Missing or Incorrect Password in Connection String

**Problem:** The connection string still has `<db_password>` placeholder.

**Solution:** Create a `.env` file in the `backend` directory:

```env
MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_ACTUAL_PASSWORD@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=ARINTERIORDESIGNAPP
```

**Important:** 
- Replace `YOUR_ACTUAL_PASSWORD` with your real MongoDB password
- If your password contains special characters, URL-encode them:
  - `@` becomes `%40`
  - `#` becomes `%23`
  - `%` becomes `%25`
  - etc.

### 2. IP Address Not Whitelisted in MongoDB Atlas

**Problem:** Your IP address is not allowed to connect to MongoDB Atlas.

**Solution:**
1. Go to MongoDB Atlas dashboard
2. Click **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Either:
   - Add your current IP address
   - Or for development: Add `0.0.0.0/0` (allows all IPs - **not recommended for production**)

### 3. Network/Firewall Blocking Connection

**Problem:** Your firewall or network is blocking MongoDB connections.

**Solution:**
- Check Windows Firewall settings
- Check if you're behind a corporate firewall
- Try from a different network
- Check if your ISP blocks MongoDB ports

### 4. Connection String Format Issue

**Problem:** The connection string might have formatting issues.

**Solution:** Verify your connection string format:
```
mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
```

Make sure:
- No spaces in the connection string
- Password is URL-encoded if it has special characters
- Database name is set separately in `MONGODB_DB_NAME`

## Quick Fix Steps

### Step 1: Create `.env` File

Create `backend/.env` file:

```env
MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_PASSWORD_HERE@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=ARINTERIORDESIGNAPP
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

### Step 2: Whitelist Your IP in MongoDB Atlas

1. Log into MongoDB Atlas: https://cloud.mongodb.com/
2. Select your cluster
3. Go to **Network Access**
4. Click **Add IP Address**
5. Click **Allow Access from Anywhere** (for development) or add your specific IP
6. Wait 1-2 minutes for changes to propagate

### Step 3: Verify Password

Make sure your MongoDB password is correct:
- Check MongoDB Atlas → Database Access
- Verify the username: `shilapuk_db_user`
- Reset password if needed

### Step 4: Restart Server

```powershell
# Stop server (Ctrl+C)
cd backend
npm start
```

## Testing Connection

After fixing, you should see:
```
[MongoDB] ✅ Connected successfully
[MongoDB] Database: ARINTERIORDESIGNAPP
```

## If Still Not Working

1. **Check MongoDB Atlas Status:**
   - Go to MongoDB Atlas dashboard
   - Verify cluster is running (not paused)

2. **Test Connection String:**
   - Try connecting with MongoDB Compass using the same connection string
   - If Compass works but Node.js doesn't, it's a code issue
   - If Compass doesn't work, it's a network/credentials issue

3. **Check Logs:**
   - Look for more detailed error messages
   - Check MongoDB Atlas logs

4. **Verify Database User:**
   - MongoDB Atlas → Database Access
   - Ensure `shilapuk_db_user` has proper permissions
   - User should have at least "Read and write" permissions

## Security Note

⚠️ **Never commit `.env` file to git!** It contains sensitive credentials.

Make sure `.env` is in `.gitignore`:
```
backend/.env
```
