# Reclaim Protocol Integration Guide

This document explains how to set up and use the Reclaim Protocol integration for Steam proof generation.

## Overview

The Reclaim Protocol integration allows users to generate cryptographic proofs of their Steam game ownership. The sensitive credentials (`RECLAIM_APP_SECRET`) are now securely stored in the backend, and the Chrome extension communicates with the backend API to generate proofs.

## Setup Instructions

### 1. Backend Configuration

#### Environment Variables

1. Copy the example environment file:
```bash
cd server
cp .env.example .env
```

2. Edit `.env` and add your Reclaim credentials:
```env
# Reclaim Protocol Configuration
RECLAIM_APP_ID=your_reclaim_app_id_here
RECLAIM_APP_SECRET=your_reclaim_app_secret_here

# For development, keep this as true. Set to false for production
ZKP_MOCK=true
```

3. Get your credentials from [Reclaim Developer Portal](https://dev.reclaimprotocol.org/)

#### Install Dependencies

```bash
cd server
npm install
```

#### Start the Backend Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

The server will run on `http://localhost:3000`

### 2. Chrome Extension Setup

#### Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension/steam-purchase-history` directory
5. The extension will be added to your browser

#### Using the Extension

1. **Visit Steam Website**: Go to `store.steampowered.com` and log in
2. **Click Extension Icon**: Click the Steam Data Viewer extension icon
3. **Fetch Steam Data**: Click "Fetch Steam User Data" to retrieve your account information
4. **Generate Proof**:
   - Switch to the "Reclaim Proof" tab
   - (Optional) Enter a specific App ID to prove ownership of a particular game
   - Click "Generate Proof"
   - The proof will be generated via the backend API

## API Endpoints

### Generate Steam Proof
```http
POST http://localhost:3000/api/zkp/steam/proof
Content-Type: application/json

{
  "steamId": "76561198123456789",
  "userDataUrl": "https://store.steampowered.com/dynamicstore/userdata/?id=76561198123456789",
  "cookieStr": "steamLoginSecure=...",
  "targetAppId": "730"  // Optional: specific game ID
}
```

### Verify Steam Proof
```http
POST http://localhost:3000/api/zkp/steam/verify
Content-Type: application/json

{
  "proof": { /* proof object */ },
  "steamId": "76561198123456789",
  "targetAppId": "730"  // Optional
}
```

## Development Mode

When `ZKP_MOCK=true` is set in the `.env` file, the system operates in mock mode:
- No real Reclaim API calls are made
- Mock proofs are generated instantly
- Useful for development and testing

## Production Mode

For production use:
1. Set `ZKP_MOCK=false` in `.env`
2. Ensure valid Reclaim credentials are configured
3. Use HTTPS for the backend API
4. Configure proper CORS settings

## Testing

### Test with Mock Mode

1. Ensure `ZKP_MOCK=true` in `.env`
2. Start the backend server
3. Load the Chrome extension
4. Generate a proof - it should return instantly with mock data

### Test with Real Reclaim

1. Set `ZKP_MOCK=false` in `.env`
2. Add valid Reclaim credentials
3. Restart the backend server
4. Generate a proof - it will make real API calls to Reclaim

## Troubleshooting

### Backend Issues

- **Port already in use**: Change the PORT in `.env` or stop the conflicting process
- **Database connection failed**: Ensure PostgreSQL is running and DATABASE_URL is correct
- **Reclaim API errors**: Verify your APP_ID and APP_SECRET are correct

### Chrome Extension Issues

- **Cannot fetch Steam data**: Ensure you're logged into Steam website
- **Backend connection failed**: Check that the backend server is running on port 3000
- **CORS errors**: The backend should have CORS configured for Chrome extensions

### Common Error Messages

- `Missing RECLAIM_APP_ID or RECLAIM_APP_SECRET`: Add credentials to `.env`
- `Failed to create proof`: Check backend logs for detailed error
- `Please visit Steam website first`: Navigate to Steam and log in

## Security Considerations

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use environment variables** - Don't hardcode secrets
3. **HTTPS in production** - Always use HTTPS for API calls in production
4. **Validate inputs** - The backend validates all inputs with Zod schemas
5. **Rate limiting** - Consider adding rate limiting for production

## Architecture

```
Chrome Extension (Frontend)
    ↓
    ├── Fetches Steam data (cookies, user ID)
    ├── Sends to Backend API
    ↓
Backend Server (Node.js/Express)
    ↓
    ├── Stores RECLAIM_APP_SECRET securely
    ├── Calls Reclaim SDK with credentials
    ├── Generates cryptographic proof
    ├── Returns proof to extension
    ↓
Extension displays proof to user
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs: `npm run dev` shows detailed logs
3. Check browser console for extension errors
4. Ensure all dependencies are installed correctly