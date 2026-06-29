# Backend Environment Variables Setup

## Quick Setup

The `.env` file has been created in the `backend/` directory with the following configuration:

```env
PORT=3000
NODE_ENV=development
PEXELS_API_KEY=OdfpmqRFbKh3StVE19NieMW9QYAhDuQWSftDvYd0rPQRBMowMAjILJ9O
THEME_RECOMMENDATION_API_KEY=OdfpmqRFbKh3StVE19NieMW9QYAhDuQWSftDvYd0rPQRBMowMAjILJ9O
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006
```

## Environment Variables Reference

### Required Variables

- **PORT** - Server port (default: 3000)
- **NODE_ENV** - Environment mode: `development` or `production`

### Pexels API Configuration

- **PEXELS_API_KEY** - Your Pexels API key for image search
- **THEME_RECOMMENDATION_API_KEY** - Alternative name for Pexels API key

The Pexels API key is already configured and will be used for:
- Theme recommendation image search
- Explore tab image search
- Custom design image generation

### Groq API Configuration

- **GROQ_API_KEY** - Your Groq API key for AI design generation (get one at https://console.groq.com)

The Groq API key is used for:
- AI design prompt analysis
- Design idea generation
- Enhanced design descriptions and titles
- Color palette suggestions
- Furniture layout generation (`/api/designs/generate-layout`)

### Hugging Face API Configuration (optional)

- **HF_API_KEY** - Hugging Face API key for AI image generation (FLUX.1-schnell)

When configured alongside `GROQ_API_KEY`, the backend uses Groq to enhance prompts and Hugging Face to generate images. Without `HF_API_KEY`, Groq-enhanced prompts fall back to Pexels image search.

### Optional Variables

- **ALLOWED_ORIGINS** - Comma-separated list of allowed CORS origins
  - Default: `http://localhost:8081,http://localhost:19006`
  - Add your device IP if needed: `http://192.168.1.131:19006`

- **OPENAI_API_KEY** - For other AI features (optional)

- **SENTRY_DSN** - Sentry error tracking DSN (optional)
- **SENTRY_ENVIRONMENT** - Sentry environment name (optional)

- **DATABASE_URL** - MongoDB connection string (if using database)

## Verifying Configuration

After creating/updating `.env`, restart the backend server:

```powershell
# Stop the server (Ctrl+C)
# Then start again
cd backend
npm start
```

You should see in the logs:
```
[ImageGeneration] Using Pexels API key
🚀 Server running on port 3000
```

## Troubleshooting

If the Pexels API isn't working:
1. Verify the `.env` file exists in `backend/` directory
2. Check that `PEXELS_API_KEY` is set correctly
3. Restart the backend server after changing `.env`
4. Check server logs for `[ImageGeneration] Using Pexels API key`

## Security Note

The `.env` file is in `.gitignore` and should NOT be committed to git.
Only commit `.env.example` if you want to share a template.
