export const config = {
  DEV_COOKIES: process.env.DEV_COOKIES || "",
  
  PORT: process.env.PORT || 3000,
  
  POE_API_BASE: "https://www.pathofexile.com/api/trade2",
  
  POE_SITE_BASE: "https://www.pathofexile.com",
  
  REQUEST_TIMEOUT: 30000,
  
  IS_DEVELOPMENT: process.env.NODE_ENV !== "production",
};

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
}

export interface TradeApiResponse {
  postRequest?: SanitizedInterceptedRequest;
  getRequest?: SanitizedInterceptedRequest;
  searchData?: TradeSearchData;
  items?: TradeResultData[];
  error?: string;
}