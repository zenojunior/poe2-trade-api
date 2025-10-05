# Path of Exile 2 Trade API Interceptor

Este projeto intercepta requisições feitas para a API de trade do Path of Exile 2 e expõe os dados através de um endpoint REST.

## 🚀 Instalação Rápida

```bash
# Clonar/baixar o projeto
cd poe2-trade-api

# Instalar dependências
bun install

# Instalar browsers do Playwright
bunx playwright install chromium

# Configurar cookies de desenvolvimento (veja seção abaixo)
cp .env.example .env
# Edite o arquivo .env com seus cookies

# Executar em modo desenvolvimento
bun run dev
# OU use o script de desenvolvimento
./dev.sh
```

## 🔐 Configuração de Cookies

### Para Desenvolvimento

**Opção 1: Arquivo de ambiente (.env)**

```bash
cp .env.example .env
# Edite o arquivo .env e configure:
DEV_COOKIES="POESESSID=seu_cookie_aqui"
```

**Opção 2: Script de desenvolvimento**

```bash
# Edite o arquivo dev.sh e configure o DEV_COOKIES
./dev.sh
```

**Opção 3: Constante no código**

```typescript
// Em src/config.ts, edite a linha:
DEV_COOKIES: "POESESSID=seu_cookie_aqui",
```

### Para Produção

Envie os cookies através do header `X-POE-Cookies` nas requisições.

### 🍪 Como obter os cookies do PoE2

1. Abra o site do Path of Exile 2 no seu navegador
2. Faça login na sua conta
3. Abra as ferramentas de desenvolvedor (F12)
4. Vá para a aba "Network" ou "Rede"
5. Acesse uma página de trade
6. Encontre uma requisição para `pathofexile.com`
7. Copie o valor do header `Cookie`
8. Use esse valor nas configurações acima

## 📡 Endpoints da API

### `GET /api/trade`

Intercepta e retorna dados de uma URL de trade do PoE2.

**Parâmetros:**

- `url` (obrigatório): URL completa do trade do PoE2

**Headers (produção):**

- `X-POE-Cookies`: String com os cookies necessários

**Exemplo:**

```bash
curl "http://localhost:3000/api/trade?url=https://www.pathofexile.com/trade2/search/poe2/Rise%20of%20the%20Abyssal/EB3jnpzzt5"
```

**Resposta:**

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

Status da aplicação.

### `GET /`

Documentação e informações da API.

## 🛠 Scripts Disponíveis

```bash
# Desenvolvimento com hot reload
bun run dev

# Produção
bun run start

# Build da aplicação
bun run build

# Verificação de tipos TypeScript
bun run type-check

# Script de desenvolvimento com cookies
./dev.sh
```

## 🏗 Como Funciona

1. **Recebe** uma URL do trade do PoE2
2. **Abre** a página usando Playwright (Chromium headless)
3. **Intercepta** todas as requisições para `/api/trade2`
4. **Captura** o POST inicial (dados da busca) e o GET subsequente (resultados)
5. **Retorna** os dados interceptados via API REST

## 📝 Estrutura das URLs do PoE2

```
https://www.pathofexile.com/trade2/search/poe2/{league}/{tradeId}
```

- **Liga**: `Rise%20of%20the%20Abyssal` (dinâmico)
- **Trade ID**: `EB3jnpzzt5` (dinâmico)

## 🔧 Desenvolvimento

### Estrutura do Projeto

```
src/
├── config.ts      # Configurações e tipos
├── interceptor.ts # Lógica de interceptação com Playwright
└── index.ts       # Servidor HTTP principal
```

### Logs e Debug

O projeto inclui logs detalhados para debugging:

- 🔍 Interceptação de requisições
- ✅ Captura de respostas
- 📋 Processamento de dados
- ❌ Tratamento de erros

## ⚠️ Considerações

- **Cookies**: Necessários para acessar a API privada do PoE2
- **Rate Limiting**: Respeite os limites da API do PoE2
- **Headless Browser**: Usa Chromium via Playwright
- **CORS**: Configurado para permitir requisições de qualquer origem

## 🐛 Troubleshooting

**Erro "Cookies são obrigatórios":**

- Configure DEV_COOKIES no desenvolvimento ou envie X-POE-Cookies em produção

**Timeout nas requisições:**

- Verifique se a URL do PoE2 está correta
- Confirme se os cookies estão válidos

**Erro de dependências:**

- Execute `bunx playwright install chromium`
- Verifique se todas as dependências foram instaladas com `bun install`
