// Configurações da aplicação
export const config = {
  // Cookies para desenvolvimento - CONFIGURE AQUI SEUS COOKIES DO POE2
  DEV_COOKIES: process.env.DEV_COOKIES || "",
  
  // Porta 
  PORT: process.env.PORT || 3000,
  
  // URL base da API do PoE2
  POE_API_BASE: "https://www.pathofexile.com/api/trade2",
  
  // URL base do site do PoE2
  POE_SITE_BASE: "https://www.pathofexile.com",
  
  // Timeout para requisições em milissegundos
  REQUEST_TIMEOUT: 30000,
  
  // Modo de desenvolvimento
  IS_DEVELOPMENT: process.env.NODE_ENV !== "production",
};

// Tipos para as requisições interceptadas
export interface TradeSearchData {
  query: any;
  sort: any;
  [key: string]: any;
}

export interface TradeResultData {
  id: string;
  item: any;
  listing: any;
  [key: string]: any;
}

export interface InterceptedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  postData?: string;
  response?: any;
}

export interface SanitizedInterceptedRequest {
  method: string;
  url: string;
  postData?: string;
  response?: any;
}

export interface TradeApiResponse {
  postRequest?: SanitizedInterceptedRequest;
  getRequest?: SanitizedInterceptedRequest;
  searchData?: TradeSearchData;
  results?: TradeResultData[];
  error?: string;
}