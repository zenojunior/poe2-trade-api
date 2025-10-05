# Path of Exile 2 Trade API Interceptor

This project intercepts requests made to the Path of Exile 2 trade API and exposes the data through a REST endpoint.

## 🚀 Quick Installation

```bash
# Clone/download the project
cd poe2-trade-api

# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium

# Configure development cookies (see section below)
cp .env.example .env
# Edit the .env file with your cookies

# Run in development mode
bun run dev
# OR use the development script
./dev.sh
```

## 🔐 Cookie Configuration

### For Development

**Option 1: Environment file (.env)**

```bash
cp .env.example .env
# Edit the .env file and configure:
DEV_COOKIES="POESESSID=your_cookie_here"
```

**Option 2: Development script**

```bash
# Edit the dev.sh file and configure DEV_COOKIES
./dev.sh
```

**Option 3: Constant in code**

```typescript
// In src/config.ts, edit the line:
DEV_COOKIES: "POESESSID=your_cookie_here",
```

### For Production

Send cookies via the `X-POE-Cookies` header in requests.

### 🍪 How to get PoE2 cookies

1. Open the Path of Exile 2 website in your browser
2. Log in to your account
3. Open developer tools (F12)
4. Go to the "Network" tab
5. Access a trade page
6. Find a request to `pathofexile.com`
7. Copy the value of the `Cookie` header
8. Use this value in the configurations above

## 📡 API Endpoints

### `GET /api/trade`

Intercepts and returns data from a PoE2 trade URL.

**Parameters:**

- `url` (required): Complete PoE2 trade URL

**Headers (production):**

- `X-POE-Cookies`: String with necessary cookies

**Example:**

```bash
curl "http://localhost:3000/api/trade?url=https://www.pathofexile.com/trade2/search/poe2/Rise%20of%20the%20Abyssal/EB3jnpzzt5"
```

**Response:**

```json
{
  "postRequest": {
    "method": "POST",
    "url": "https://www.pathofexile.com/api/trade2/search/poe2/Rise%20of%20the%20Abyssal",
    "headers": {...},
    "postData": "{...}",
    "response": {...}
  },
  "getRequest": {
    "method": "GET",
    "url": "https://www.pathofexile.com/api/trade2/fetch/...",
    "response": {...}
  },
  "searchData": {...},
  "results": [...],
  "metadata": {
    "tradeUrl": "...",
    "league": "Rise of the Abyssal",
    "tradeId": "EB3jnpzzt5",
    "timestamp": "2025-01-01T00:00:00.000Z",
    "interceptedRequestsCount": 2
  }
}
```

### `GET /health`

Application status.

### `GET /`

API documentation and information.

## 🛠 Available Scripts

```bash
# Development with hot reload
bun run dev

# Production
bun run start

# Build application
bun run build

# TypeScript type checking
bun run type-check

# Development script with cookies
./dev.sh
```

## 🏗 How It Works

1. **Receives** a PoE2 trade URL
2. **Opens** the page using Playwright (headless Chromium)
3. **Intercepts** all requests to `/api/trade2`
4. **Captures** the initial POST (search data) and subsequent GET (results)
5. **Returns** the intercepted data via REST API

## 📝 PoE2 URL Structure

```
https://www.pathofexile.com/trade2/search/poe2/{league}/{tradeId}
```

- **League**: `Rise%20of%20the%20Abyssal` (dynamic)
- **Trade ID**: `EB3jnpzzt5` (dynamic)

## 🔧 Development

### Project Structure

```
src/
├── config.ts      # Configuration and types
├── interceptor.ts # Interception logic with Playwright
└── index.ts       # Main HTTP server
```

### Logs and Debug

The project includes detailed logs for debugging:

- 🔍 Request interception
- ✅ Response capture
- 📋 Data processing
- ❌ Error handling

## ⚠️ Considerations

- **Cookies**: Required to access PoE2's private API
- **Rate Limiting**: Respect PoE2 API limits
- **Headless Browser**: Uses Chromium via Playwright
- **CORS**: Configured to allow requests from any origin

## 🐛 Troubleshooting

**Error "Cookies are required":**

- Configure DEV_COOKIES in development or send X-POE-Cookies in production

**Request timeout:**

- Check if the PoE2 URL is correct
- Confirm cookies are valid

**Dependency error:**

- Run `bunx playwright install chromium`
- Check if all dependencies were installed with `bun install`
