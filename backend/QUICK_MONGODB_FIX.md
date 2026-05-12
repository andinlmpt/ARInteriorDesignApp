# Quick MongoDB Connection Fix

## Current Error
```
[MongoDB] ❌ Connection error: querySrv ECONNREFUSED _mongodb._tcp.cluster0.wtbvl5m.mongodb.net
```

## Most Common Fix (90% of cases)

### 1. Create `.env` file with your password

Create `backend/.env`:
```env
MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_PASSWORD@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=ARINTERIORDESIGNAPP
```

**Replace `YOUR_PASSWORD` with your actual MongoDB password!**

### 2. Whitelist Your IP in MongoDB Atlas

1. Go to: https://cloud.mongodb.com/
2. Click **Network Access** (left sidebar)
3. Click **Add IP Address**
4. Click **Allow Access from Anywhere** (for development)
5. Wait 2 minutes

### 3. Test Connection

```powershell
cd backend
node test-mongodb-connection.js
```

This will tell you exactly what's wrong.

### 4. Restart Server

```powershell
npm start
```

## If Still Not Working

Run the test script to get detailed error information:
```powershell
node test-mongodb-connection.js
```

The script will check:
- ✅ If password placeholder exists
- ✅ Connection string format
- ✅ Actual connection attempt
- ✅ Specific error messages

## Common Issues

| Error | Solution |
|-------|----------|
| `<db_password>` in connection string | Create `.env` file with real password |
| `ECONNREFUSED` | Whitelist IP in MongoDB Atlas |
| `Authentication failed` | Check password is correct |
| `querySrv` error | Network/DNS issue - check firewall |

## Need Help?

1. Run: `node test-mongodb-connection.js`
2. Check the error message
3. Follow the specific solution provided
