import { PoETradeInterceptor } from "./interceptor";
import { config } from "./config";

const interceptor = new PoETradeInterceptor();

// Função para extrair parâmetros da URL do PoE2
function parsePoEUrl(url: string): { league: string; tradeId: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');https://www.pathofexile.com/api/trade2
    
    // Formato esperado: /trade2/search/poe2/{league}/{tradeId}
    if (pathParts.length >= 6 && pathParts[1] === 'trade2' && pathParts[2] === 'search' && pathParts[3] === 'poe2') {
      return {
        league: decodeURIComponent(pathParts[4]),
        tradeId: pathParts[5]
      };
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao fazer parse da URL:", error);
    return null;
  }
}

// Função para validar URL do PoE2
function isValidPoEUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'www.pathofexile.com' && url.includes('/trade2/search/poe2/');
  } catch {
    return false;
  }
}

// Função para obter cookies do request
function getCookiesFromRequest(req: Request): string | undefined {
  // Primeiro, tentar o header personalizado para produção
  const customCookies = req.headers.get('X-POE-Cookies');
  if (customCookies) {
    return customCookies;
  }
  
  // Se estiver em desenvolvimento, usar a constante
  if (config.IS_DEVELOPMENT && config.DEV_COOKIES) {
    return config.DEV_COOKIES;
  }
  
  // Como fallback, tentar usar cookies normais do request
  const cookieHeader = req.headers.get('Cookie');
  if (cookieHeader) {
    return cookieHeader;
  }
  
  return undefined;
}

// Inicializar o interceptor
await interceptor.init();
console.log("🚀 Interceptor inicializado");

const server = Bun.serve({
  port: config.PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Configurar CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-POE-Cookies',
      'Content-Type': 'application/json',
    };
    
    // Responder OPTIONS para CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204, 
        headers: corsHeaders 
      });
    }
    
    // Endpoint principal da API
    if (url.pathname === '/api/trade' && req.method === 'GET') {
      try {
        const tradeUrl = url.searchParams.get('url');
        
        if (!tradeUrl) {
          return new Response(
            JSON.stringify({ 
              error: 'Parâmetro "url" é obrigatório',
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
              error: 'URL inválida. Deve ser uma URL válida do PoE2 trade',
              provided: tradeUrl,
              expected: 'https://www.pathofexile.com/trade2/search/poe2/{league}/{tradeId}'
            }), 
            { 
              status: 400, 
              headers: corsHeaders 
            }
          );
        }
        
        // Extrair informações da URL
        const urlInfo = parsePoEUrl(tradeUrl);
        console.log(`📋 Processando trade - Liga: ${urlInfo?.league}, ID: ${urlInfo?.tradeId}`);
        
        // Obter cookies
        const cookies = getCookiesFromRequest(req);
        
        if (!cookies && !config.IS_DEVELOPMENT) {
          return new Response(
            JSON.stringify({ 
              error: 'Cookies são obrigatórios. Envie através do header X-POE-Cookies',
              note: 'Em desenvolvimento, configure DEV_COOKIES no arquivo config.ts'
            }), 
            { 
              status: 401, 
              headers: corsHeaders 
            }
          );
        }
        
        console.log(`🔐 Usando cookies: ${cookies ? 'Configurados' : 'Não fornecidos'}`);
        
        // Interceptar as requisições
        const result = await interceptor.interceptTradeRequests(tradeUrl, cookies);
        
        // Adicionar metadados
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
        console.error('❌ Erro no endpoint /api/trade:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Erro interno do servidor',
            details: error instanceof Error ? error.message : String(error)
          }), 
          { 
            status: 500, 
            headers: corsHeaders 
          }
        );
      }
    }
    
    // Endpoint de saúde
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
    
    // Endpoint de informações
    if (url.pathname === '/' && req.method === 'GET') {
      return new Response(
        JSON.stringify({
          service: 'PoE2 Trade API Interceptor',
          version: '1.0.0',
          endpoints: {
            'GET /api/trade?url={poe2_url}': 'Intercepta requisições de trade do PoE2',
            'GET /health': 'Status da aplicação',
            'GET /': 'Esta página'
          },
          usage: {
            development: 'Configure DEV_COOKIES no arquivo src/config.ts',
            production: 'Envie cookies através do header X-POE-Cookies'
          },
          example: `/api/trade?url=${encodeURIComponent('https://www.pathofexile.com/trade2/search/poe2/Rise%20of%20the%20Abyssal/EB3jnpzzt5')}`
        }, null, 2), 
        { 
          status: 200, 
          headers: corsHeaders 
        }
      );
    }
    
    // 404 para outras rotas
    return new Response(
      JSON.stringify({ 
        error: 'Endpoint não encontrado',
        availableEndpoints: ['/', '/health', '/api/trade']
      }), 
      { 
        status: 404, 
        headers: corsHeaders 
      }
    );
  }
});

console.log(`🌟 Servidor rodando em http://localhost:${server.port}`);
console.log(`📖 Documentação disponível em http://localhost:${server.port}/`);

// Cleanup quando o processo for finalizado
process.on('SIGINT', async () => {
  console.log("\n🛑 Finalizando servidor...");
  await interceptor.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log("\n🛑 Finalizando servidor...");
  await interceptor.cleanup();
  process.exit(0);
});