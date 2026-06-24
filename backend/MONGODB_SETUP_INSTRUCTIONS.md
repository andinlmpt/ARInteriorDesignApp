# MongoDB Setup Instructions

## ✅ Configuration Updated

Your MongoDB connection string has been updated to:
```
mongodb+srv://shilapuk_db_user:<db_password>@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
```

## ⚠️ Important: Replace Password

**You need to replace `<db_password>` with your actual MongoDB password!**

### Option 1: Use Environment Variable (Recommended)

Create a `.env` file in the `backend` directory:

```env
MONGODB_URI=mongodb+srv://shilapuk_db_user:YOUR_ACTUAL_PASSWORD@cluster0.wtbvl5m.mongodb.net/?appName=Cluster0
MONGODB_DB_NAME=ar_interior_design
```

Replace `YOUR_ACTUAL_PASSWORD` with your real MongoDB password.

### Option 2: Update Code Directly

Edit `backend/src/db/mongodb.js` and replace `<db_password>` in line 11 with your actual password.

## After Setting Password

1. **Restart your server:**
   ```powershell
   # Stop the server (Ctrl+C if running)
   cd backend
   npm start
   ```

2. **Check the logs** - You should see:
   ```
   [MongoDB] ✅ Connected successfully
   [MongoDB] Database: ar_interior_design
   ```

## MongoDB Atlas Checklist

Make sure in MongoDB Atlas:

1. ✅ **Network Access**: Your IP address is whitelisted (or allow from anywhere `0.0.0.0/0` for development)
2. ✅ **Database User**: `shilapuk_db_user` exists and has the correct password
3. ✅ **Database**: `ar_interior_design` database exists (or will be created automatically)

## Troubleshooting

If you still get connection errors:

1. **Check password** - Make sure it's correct and URL-encoded if it contains special characters
2. **Check IP whitelist** - Go to MongoDB Atlas → Network Access → Add your IP
3. **Check connection string** - Verify the username and cluster name are correct
4. **Check firewall** - Make sure your firewall isn't blocking MongoDB connections

## Security Note

⚠️ **Never commit your `.env` file to git!** It contains sensitive credentials.

The `.env` file should be in `.gitignore` (which it should be by default).
