import { chromium, Browser, BrowserContext, Page } from "playwright";
import { config, InterceptedRequest, TradeApiResponse, SanitizedInterceptedRequest } from "./config";

interface BrowserSession {
  context: BrowserContext;
  page: Page;
  interceptedRequests: InterceptedRequest[];
}

export class PoETradeInterceptor {
  private browser: Browser | null = null;
  
  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log("🚀 Browser pool initialized");
  }
  
  private async createIsolatedSession(): Promise<BrowserSession> {
    if (!this.browser) {
      throw new Error("Interceptor not initialized. Call init() first.");
    }
    
    const context = await this.browser.newContext();
    const page = await context.newPage();
    const interceptedRequests: InterceptedRequest[] = [];
    
    // Each session has its own isolated interceptor
    await page.route('**/*', async (route, request) => {
      const url = request.url();
      
      if (url.includes('/api/trade2') && !url.includes('/api/trade2/data')) {
        console.log(`🔍 Intercepting: ${request.method()} ${url}`);
        
        const interceptedReq: InterceptedRequest = {
          method: request.method(),
          url: url,
          headers: request.headers(),
          postData: request.postData() || undefined,
        };
        
        interceptedRequests.push(interceptedReq);
        
        const response = await route.fetch();
        
        if (response.ok()) {
          try {
            const responseData = await response.json();
            interceptedReq.response = responseData;
            console.log(`✅ Response captured for: ${request.method()} ${url}`);
          } catch (error) {
            console.log(`⚠️ Error capturing JSON response: ${error}`);
            interceptedReq.response = await response.text();
          }
        }
        
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });
    
    return { context, page, interceptedRequests };
  }
  
  private async cleanupSession(session: BrowserSession): Promise<void> {
    try {
      await session.page.close();
      await session.context.close();
    } catch (error) {
      console.error("⚠️ Error cleaning up session:", error);
    }
  }
  
  async interceptTradeRequests(tradeUrl: string, cookies?: string): Promise<TradeApiResponse> {
    const sessionId = Math.random().toString(36).substr(2, 9);
    console.log(`🚀 [${sessionId}] Starting isolated session for: ${tradeUrl}`);
    
    let session: BrowserSession | null = null;
    
    try {
      // Create isolated session for this request
      session = await this.createIsolatedSession();
      console.log(`🔒 [${sessionId}] Session created with isolated context`);
      
      const cookiesToUse = cookies || config.DEV_COOKIES;
      
      if (cookiesToUse) {
        const cookieObjects = cookiesToUse.split(';').map(cookie => {
          const [name, value] = cookie.trim().split('=');
          return {
            name: name.trim(),
            value: value.trim(),
            domain: '.pathofexile.com',
            path: '/'
          };
        });
        
        await session.context.addCookies(cookieObjects);
        console.log(`🍪 [${sessionId}] Cookies configured`);
      }
      
      console.log(`🌐 [${sessionId}] Navigating to: ${tradeUrl}`);
      
      await session.page.goto(tradeUrl, { 
        waitUntil: 'networkidle',
        timeout: config.REQUEST_TIMEOUT 
      });
      
      await session.page.waitForTimeout(3000);
      
      await this.waitForApiRequests(session, sessionId);
      
      const result = this.processInterceptedData(session.interceptedRequests, sessionId);
      console.log(`✅ [${sessionId}] Session completed successfully`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ [${sessionId}] Error during interception:`, error);
      return {
        error: `Error during interception: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      // Always cleanup the session
      if (session) {
        await this.cleanupSession(session);
        console.log(`🧹 [${sessionId}] Session cleaned up`);
      }
    }
  }
  
  private async waitForApiRequests(session: BrowserSession, sessionId: string): Promise<void> {
    const maxWaitTime = 15000;
    const checkInterval = 500;
    let waitedTime = 0;
    
    while (waitedTime < maxWaitTime) {
      const postSearchReq = session.interceptedRequests.find((req: InterceptedRequest) => 
        req.method === 'POST' && 
        req.url.includes('https://www.pathofexile.com/api/trade2/search/poe2')
      );
      
      const getFetchReq = session.interceptedRequests.find((req: InterceptedRequest) => 
        req.method === 'GET' && 
        req.url.includes('https://www.pathofexile.com/api/trade2/fetch')
      );
      
      if (postSearchReq && getFetchReq) {
        console.log(`✅ [${sessionId}] Both specific requests captured!`);
        console.log(`   - POST search: ${postSearchReq.url.substring(0, 80)}...`);
        console.log(`   - GET fetch: ${getFetchReq.url.substring(0, 80)}...`);
        break;
      }
      
      if (waitedTime % 2000 === 0) {
        const hasPost = postSearchReq ? '✓' : '✗';
        const hasGet = getFetchReq ? '✓' : '✗';
        console.log(`🔍 [${sessionId}] Waiting for APIs: POST search ${hasPost} | GET fetch ${hasGet} (${waitedTime/1000}s)`);
      }
      
      await session.page.waitForTimeout(checkInterval);
      waitedTime += checkInterval;
    }
    
    if (waitedTime >= maxWaitTime) {
      console.log(`⚠️ [${sessionId}] Timeout waiting for specific API requests`);
      console.log(`   Intercepted: ${session.interceptedRequests.length} requests`);
      session.interceptedRequests.forEach((req: InterceptedRequest) => {
        console.log(`   - ${req.method} ${req.url.substring(0, 100)}...`);
      });
    }
  }
  
  private processInterceptedData(interceptedRequests: InterceptedRequest[], sessionId: string): TradeApiResponse {
    console.log(`📊 [${sessionId}] Processing ${interceptedRequests.length} intercepted requests`);
    
    const postSearchRequest = interceptedRequests.find((req: InterceptedRequest) => 
      req.method === 'POST' && 
      req.url.includes('https://www.pathofexile.com/api/trade2/search/poe2')
    );
    
    const getFetchRequest = interceptedRequests.find((req: InterceptedRequest) => 
      req.method === 'GET' && 
      req.url.includes('https://www.pathofexile.com/api/trade2/fetch')
    );
    
    let searchData = undefined;
    let items = undefined;
    
    if (postSearchRequest?.postData) {
      try {
        searchData = JSON.parse(postSearchRequest.postData);
        console.log(`✅ [${sessionId}] Search data extracted from POST`);
      } catch (error) {
        console.log(`⚠️ [${sessionId}] Error parsing POST search data:`, error);
      }
    }
    
    if (getFetchRequest?.response) {
      try {
        let responseData;
        if (typeof getFetchRequest.response === 'string') {
          responseData = JSON.parse(getFetchRequest.response);
        } else {
          responseData = getFetchRequest.response;
        }
        
        if (responseData && responseData.result && Array.isArray(responseData.result)) {
          items = responseData.result;
          console.log(`✅ [${sessionId}] Results array extracted from 'result' field`);
        } else {
          items = responseData;
          console.log(`✅ [${sessionId}] Results extracted directly from response`);
        }
      } catch (error) {
        console.log(`⚠️ [${sessionId}] Error processing GET fetch response:`, error);
      }
    }
    
    const sanitizedPostRequest: SanitizedInterceptedRequest | undefined = postSearchRequest ? {
      method: postSearchRequest.method,
      url: postSearchRequest.url,
      postData: postSearchRequest.postData
    } : undefined;
    
    const sanitizedGetRequest: SanitizedInterceptedRequest | undefined = getFetchRequest ? {
      method: getFetchRequest.method,
      url: getFetchRequest.url,
      postData: getFetchRequest.postData
    } : undefined;
    
    console.log(`🎯 [${sessionId}] Specific requests found:`);
    console.log(`   - POST search: ${postSearchRequest ? '✓' : '✗'}`);
    console.log(`   - GET fetch: ${getFetchRequest ? '✓' : '✗'}`);
    
    return {
      postRequest: sanitizedPostRequest,
      getRequest: sanitizedGetRequest,
      searchData,
      items
    };
  }
  
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log("🧹 Browser pool closed");
    }
  }
}