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
    
    // Configurar interceptação de requisições
    await this.page.route('**/*', async (route, request) => {
      const url = request.url();
      
      // Interceptar apenas requisições para a API do trade
      if (url.includes('/api/trade2')) {
        console.log(`🔍 Interceptando: ${request.method()} ${url}`);
        
        const interceptedReq: InterceptedRequest = {
          method: request.method(),
          url: url,
          headers: request.headers(),
          postData: request.postData() || undefined,
        };
        
        this.interceptedRequests.push(interceptedReq);
        
        // Continuar com a requisição original
        const response = await route.fetch();
        
        // Capturar a resposta
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
        // Para outras requisições, apenas continuar
        await route.continue();
      }
    });
  }
  
  async interceptTradeRequests(tradeUrl: string, cookies?: string): Promise<TradeApiResponse> {
    if (!this.page) {
      throw new Error("Interceptor não foi inicializado. Chame init() primeiro.");
    }
    
    try {
      // Limpar requisições anteriores
      this.interceptedRequests = [];
      
      // Configurar cookies se fornecidos
      const cookiesToUse = cookies || config.DEV_COOKIES;
      
      if (cookiesToUse) {
        // Parse dos cookies - assumindo formato "name1=value1; name2=value2"
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
      
      console.log(`🚀 Navegando para: ${tradeUrl}`);
      
      // Navegar para a página e aguardar o carregamento
      await this.page.goto(tradeUrl, { 
        waitUntil: 'networkidle',
        timeout: config.REQUEST_TIMEOUT 
      });
      
      // Aguardar um pouco mais para garantir que as requisições sejam feitas
      await this.page.waitForTimeout(3000);
      
      // Aguardar especificamente pelas requisições da API
      await this.waitForApiRequests();
      
      // Processar e retornar os dados interceptados
      return this.processInterceptedData();
      
    } catch (error) {
      console.error("❌ Erro durante interceptação:", error);
      return {
        error: `Erro durante interceptação: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  private async waitForApiRequests(): Promise<void> {
    const maxWaitTime = 15000; // 15 segundos
    const checkInterval = 500; // 500ms
    let waitedTime = 0;
    
    while (waitedTime < maxWaitTime) {
      // Verificar se temos pelo menos uma requisição POST e uma GET
      const postReqs = this.interceptedRequests.filter(req => req.method === 'POST');
      const getReqs = this.interceptedRequests.filter(req => req.method === 'GET');
      
      if (postReqs.length > 0 && getReqs.length > 0) {
        console.log("✅ Requisições POST e GET capturadas!");
        break;
      }
      
      await this.page?.waitForTimeout(checkInterval);
      waitedTime += checkInterval;
    }
    
    if (waitedTime >= maxWaitTime) {
      console.log("⚠️ Timeout aguardando requisições da API");
    }
  }
  
  private processInterceptedData(): TradeApiResponse {
    console.log(`📊 Processando ${this.interceptedRequests.length} requisições interceptadas`);
    
    const postRequest = this.interceptedRequests.find(req => req.method === 'POST');
    const getRequest = this.interceptedRequests.find(req => req.method === 'GET');
    
    let searchData = undefined;
    let results = undefined;
    
    // Extrair dados da requisição POST (busca)
    if (postRequest?.postData) {
      try {
        searchData = JSON.parse(postRequest.postData);
      } catch (error) {
        console.log("⚠️ Erro ao fazer parse dos dados POST:", error);
      }
    }
    
    // Extrair resultados da requisição GET
    if (getRequest?.response) {
      try {
        if (typeof getRequest.response === 'string') {
          results = JSON.parse(getRequest.response);
        } else {
          results = getRequest.response;
        }
      } catch (error) {
        console.log("⚠️ Erro ao processar resposta GET:", error);
      }
    }
    
    // Criar versões sanitizadas das requisições sem os headers
    const sanitizedPostRequest: SanitizedInterceptedRequest | undefined = postRequest ? {
      method: postRequest.method,
      url: postRequest.url,
      postData: postRequest.postData,
      response: postRequest.response
    } : undefined;
    
    const sanitizedGetRequest: SanitizedInterceptedRequest | undefined = getRequest ? {
      method: getRequest.method,
      url: getRequest.url,
      postData: getRequest.postData,
      response: getRequest.response
    } : undefined;
    
    return {
      postRequest: sanitizedPostRequest,
      getRequest: sanitizedGetRequest,
      searchData,
      results
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