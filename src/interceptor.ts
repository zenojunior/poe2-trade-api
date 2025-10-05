import { chromium, Browser, Page, Request, Response } from "playwright";
import { config, InterceptedRequest, TradeApiResponse, SanitizedInterceptedRequest } from "./config";

export class PoETradeInterceptor {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private interceptedRequests: InterceptedRequest[] = [];
  
  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    
    await this.page.route('**/*', async (route, request) => {
      const url = request.url();
      
      if (url.includes('/api/trade2')) {
        console.log(`🔍 Interceptando: ${request.method()} ${url}`);
        
        const interceptedReq: InterceptedRequest = {
          method: request.method(),
          url: url,
          headers: request.headers(),
          postData: request.postData() || undefined,
        };
        
        this.interceptedRequests.push(interceptedReq);
        
        const response = await route.fetch();
        
        if (response.ok()) {
          try {
            const responseData = await response.json();
            interceptedReq.response = responseData;
            console.log(`✅ Resposta capturada para: ${request.method()} ${url}`);
          } catch (error) {
            console.log(`⚠️ Erro ao capturar resposta JSON: ${error}`);
            interceptedReq.response = await response.text();
          }
        }
        
        await route.fulfill({ response });
      } else {
        await route.continue();
      }
    });
  }
  
  async interceptTradeRequests(tradeUrl: string, cookies?: string): Promise<TradeApiResponse> {
    if (!this.page) {
      throw new Error("Interceptor not initialized. Call init() first.");
    }
    
    try {
      this.interceptedRequests = [];
      
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
        
        await this.page.context().addCookies(cookieObjects);
      }
      
      console.log(`🚀 Navigating to: ${tradeUrl}`);
      
      await this.page.goto(tradeUrl, { 
        waitUntil: 'networkidle',
        timeout: config.REQUEST_TIMEOUT 
      });
      
      await this.page.waitForTimeout(3000);
      
      await this.waitForApiRequests();
      
      return this.processInterceptedData();
      
    } catch (error) {
      console.error("❌ Error during interception:", error);
      return {
        error: `Error during interception: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  private async waitForApiRequests(): Promise<void> {
    const maxWaitTime = 15000;
    const checkInterval = 500;
    let waitedTime = 0;
    
    while (waitedTime < maxWaitTime) {
      const postSearchReq = this.interceptedRequests.find(req => 
        req.method === 'POST' && 
        req.url.includes('https://www.pathofexile.com/api/trade2/search/poe2')
      );
      
      const getFetchReq = this.interceptedRequests.find(req => 
        req.method === 'GET' && 
        req.url.includes('https://www.pathofexile.com/api/trade2/fetch')
      );
      
      if (postSearchReq && getFetchReq) {
        console.log("✅ Ambas requisições específicas capturadas!");
        console.log(`   - POST search: ${postSearchReq.url.substring(0, 80)}...`);
        console.log(`   - GET fetch: ${getFetchReq.url.substring(0, 80)}...`);
        break;
      }
      
      if (waitedTime % 2000 === 0) {
        const hasPost = postSearchReq ? '✓' : '✗';
        const hasGet = getFetchReq ? '✓' : '✗';
        console.log(`🔍 Waiting for APIs: POST search ${hasPost} | GET fetch ${hasGet} (${waitedTime/1000}s)`);
      }
      
      await this.page?.waitForTimeout(checkInterval);
      waitedTime += checkInterval;
    }
    
    if (waitedTime >= maxWaitTime) {
      console.log("⚠️ Timeout waiting for specific API requests");
      console.log(`   Intercepted: ${this.interceptedRequests.length} requests`);
      this.interceptedRequests.forEach(req => {
        console.log(`   - ${req.method} ${req.url.substring(0, 100)}...`);
      });
    }
  }
  
  private processInterceptedData(): TradeApiResponse {
    console.log(`📊 Processing ${this.interceptedRequests.length} intercepted requests`);
    
    const postSearchRequest = this.interceptedRequests.find(req => 
      req.method === 'POST' && 
      req.url.includes('https://www.pathofexile.com/api/trade2/search/poe2')
    );
    
    const getFetchRequest = this.interceptedRequests.find(req => 
      req.method === 'GET' && 
      req.url.includes('https://www.pathofexile.com/api/trade2/fetch')
    );
    
    let searchData = undefined;
    let items = undefined;
    
    if (postSearchRequest?.postData) {
      try {
        searchData = JSON.parse(postSearchRequest.postData);
        console.log("✅ Search data extracted from POST");
      } catch (error) {
        console.log("⚠️ Error parsing POST search data:", error);
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
          console.log("✅ Results array extracted from 'result' field");
        } else {
          items = responseData;
          console.log("✅ Results extracted directly from response");
        }
      } catch (error) {
        console.log("⚠️ Error processing GET fetch response:", error);
      }
    }
    
    const sanitizedPostRequest: SanitizedInterceptedRequest | undefined = postSearchRequest ? {
      method: postSearchRequest.method,
      url: postSearchRequest.url,
      postData: postSearchRequest.postData,
      response: postSearchRequest.response
    } : undefined;
    
    const sanitizedGetRequest: SanitizedInterceptedRequest | undefined = getFetchRequest ? {
      method: getFetchRequest.method,
      url: getFetchRequest.url,
      postData: getFetchRequest.postData,
      response: getFetchRequest.response
    } : undefined;
    
    console.log(`🎯 Specific requests found:`);
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
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.interceptedRequests = [];
  }
}