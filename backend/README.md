# AR Interior Design Backend API

Backend server for the AR Interior Design mobile application.

## Features

- ✅ Layout generation API (`/api/v1/layouts/generate`)
- ✅ Express.js server with security middleware
- ✅ CORS support for mobile app
- ✅ Rate limiting
- ✅ Request logging
- ✅ Error handling
- ✅ Input validation
- 🔄 Project management (coming soon)
- 🔄 User authentication (coming soon)
- 🔄 Database integration (coming soon)

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your settings (optional for development)

### Running the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```
GET /health
```

### Layout Generation
```
POST /api/v1/layouts/generate
Content-Type: application/json
X-API-Key: your-api-key (optional in dev)

Body:
{
  "type": "dashboard",
  "style": "modern",
  "color_scheme": ["#FFFFFF", "#F5F5F5"],
  "sections": ["Living Room", "balanced", "natural"],
  "constraints": {
    "room_dimensions": {
      "width": 5.0,
      "length": 6.0,
      "height": 2.7
    },
    "walkway_clearance": 0.9
  },
  "context": {
    "user_prompt": "Cozy living room",
    "budget": "medium",
    "optimization_goal": "balanced"
  }
}
```

Response:
```json
{
  "layout_id": "layout-1234567890-abc123",
  "proposals": [
    {
      "id": "proposal-1234567890-0",
      "structure": {
        "furniture": [...],
        "room_dimensions": {...},
        "style": "modern",
        "color_palette": [...]
      },
      "components": [...],
      "preview_url": null,
      "confidence_score": 0.85
    }
  ],
  "metadata": {
    "generated_at": "2024-01-01T00:00:00.000Z",
    "model_version": "1.0.0",
    "processing_time_ms": 150
  }
}
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

## Project Structure

```
backend/
├── src/
│   ├── server.js           # Main server file
│   ├── controllers/        # Request handlers
│   │   └── layoutController.js
│   ├── routes/             # API routes
│   │   ├── layouts.js
│   │   ├── projects.js
│   │   ├── users.js
│   │   └── themes.js
│   └── middleware/         # Express middleware
│       ├── auth.js
│       ├── validation.js
│       ├── errorHandler.js
│       └── logger.js
├── package.json
├── .env.example
└── README.md
```

## Development

The server uses ES modules. Make sure your Node.js version supports ES modules (Node 18+).

## Security

- Helmet.js for security headers
- CORS configured for mobile app origins
- Rate limiting (100 requests per 15 minutes per IP)
- Input validation on all endpoints
- Error messages sanitized in production

## Next Steps

1. Add database (SQLite for development, PostgreSQL for production)
2. Implement JWT authentication
3. Add user management endpoints
4. Add project persistence
5. Add theme recommendation API
6. Add image generation integration

## Testing

Connect your mobile app by setting:
```
EXPO_PUBLIC_LAYOUT_API_BASE_URL=http://localhost:3000/api/v1
```

Or use your server's IP address:
```
EXPO_PUBLIC_LAYOUT_API_BASE_URL=http://192.168.1.100:3000/api/v1
```

