import { PoETradeInterceptor } from "./interceptor";
import { config } from "./config";

const interceptor = new PoETradeInterceptor();

function parsePoEUrl(url: string): { league: string; tradeId: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    if (pathParts.length >= 6 && pathParts[1] === 'trade2' && pathParts[2] === 'search' && pathParts[3] === 'poe2') {
      return {
        league: decodeURIComponent(pathParts[4]),
        tradeId: pathParts[5]
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing URL:", error);
    return null;
  }
}

function isValidPoEUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'www.pathofexile.com' && url.includes('/trade2/search/poe2/');
  } catch {
    return false;
  }
}

function getCookiesFromRequest(req: Request): string | undefined {
  const customCookies = req.headers.get('X-POE-Cookies');
  if (customCookies) {
    return customCookies;
  }
  
  if (config.IS_DEVELOPMENT && config.DEV_COOKIES) {
    return config.DEV_COOKIES;
  }
  
  const cookieHeader = req.headers.get('Cookie');
  if (cookieHeader) {
    return cookieHeader;
  }
  
  return undefined;
}

await interceptor.init();
console.log("🚀 Interceptor initialized");

const server = Bun.serve({
  port: config.PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-POE-Cookies',
      'Content-Type': 'application/json',
    };
    
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }
    
    if (url.pathname === '/api/trade' && req.method === 'GET') {
      try {
        const tradeUrl = url.searchParams.get('url');
        
        if (!tradeUrl) {
          return new Response(
            JSON.stringify({ 
              error: 'Parameter "url" is required',
              example: '/api/trade?url=https://www.pathofexile.com/trade2/search/poe2/Rise%20of%20the%20Abyssal/EB3jnpzzt5'
            }), 
            { 
              status: 400, 
              headers: corsHeaders 
            }
          );
        }
        
        if (!isValidPoEUrl(tradeUrl)) {
          return new Response(
            JSON.stringify({ 
              error: 'Invalid URL. Must be a valid PoE2 trade URL',
              provided: tradeUrl,
              expected: 'https://www.pathofexile.com/trade2/search/poe2/{league}/{tradeId}'
            }), 
            { 
              status: 400, 
              headers: corsHeaders 
            }
          );
        }
        
        const urlInfo = parsePoEUrl(tradeUrl);
        console.log(`📋 Processing trade - League: ${urlInfo?.league}, ID: ${urlInfo?.tradeId}`);
        
        const cookies = getCookiesFromRequest(req);
        
        if (!cookies && !config.IS_DEVELOPMENT) {
          return new Response(
            JSON.stringify({ 
              error: 'Cookies are required. Send via X-POE-Cookies header',
              note: 'In development, configure DEV_COOKIES in config.ts file'
            }), 
            { 
              status: 401, 
              headers: corsHeaders 
            }
          );
        }
        
        console.log(`🔐 Using cookies: ${cookies ? 'Configured' : 'Not provided'}`);
        
        const result = await interceptor.interceptTradeRequests(tradeUrl, cookies);
        
        const response = {
          ...result,
          metadata: {
            tradeUrl,
            league: urlInfo?.league,
            tradeId: urlInfo?.tradeId,
            timestamp: new Date().toISOString(),
            interceptedRequestsCount: result.postRequest && result.getRequest ? 2 : 
                                    result.postRequest || result.getRequest ? 1 : 0
          }
        };
        
        return new Response(
          JSON.stringify(response, null, 2), 
          { 
            status: 200, 
            headers: corsHeaders 
          }
        );
        
      } catch (error) {
        console.error('❌ Error in /api/trade endpoint:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
          }), 
          { 
            status: 500, 
            headers: corsHeaders 
          }
        );
      }
    }
    
    if (url.pathname === '/health' && req.method === 'GET') {
      return new Response(
        JSON.stringify({ 
          status: 'OK', 
          service: 'PoE2 Trade API Interceptor',
          version: '1.0.0',
          timestamp: new Date().toISOString()
        }), 
        { 
          status: 200, 
          headers: corsHeaders 
        }
      );
    }
    
    if (url.pathname === '/' && req.method === 'GET') {
      return new Response(
        JSON.stringify({
          service: 'PoE2 Trade API Interceptor',
          version: '1.0.0',
          endpoints: {
            'GET /api/trade?url={poe2_url}': 'Intercepts PoE2 trade requests',
            'GET /health': 'Application status',
            'GET /': 'This page'
          },
          usage: {
            development: 'Configure DEV_COOKIES in src/config.ts file',
            production: 'Send cookies via X-POE-Cookies header'
          },
          example: `/api/trade?url=${encodeURIComponent('https://www.pathofexile.com/trade2/search/poe2/Rise%20of%20the%20Abyssal/EB3jnpzzt5')}`
        }, null, 2), 
        { 
          status: 200, 
          headers: corsHeaders 
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Endpoint not found',
        availableEndpoints: ['/', '/health', '/api/trade']
      }), 
      { 
        status: 404, 
        headers: corsHeaders 
      }
    );
  }
});

console.log(`🌟 Server running at http://localhost:${server.port}`);
console.log(`📖 Documentation available at http://localhost:${server.port}/`);

process.on('SIGINT', async () => {
  console.log("\n🛑 Shutting down server...");
  await interceptor.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log("\n🛑 Shutting down server...");
  await interceptor.cleanup();
  process.exit(0);
});