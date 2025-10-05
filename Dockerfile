# 1) Base com Bun
FROM oven/bun:1.2 AS base
WORKDIR /app

# 2) Dependências
COPY bun.lockb package.json ./
RUN bun install --frozen-lockfile

# 3) Código
COPY . .

# 4) Instala browsers e libs de SO necessárias ao Playwright
#    (em Debian/Ubuntu o --with-deps resolve os pacotes nativos)
RUN npx playwright install --with-deps chromium

# 5) SE quiser compilar seu código, marque Playwright/electron como externos
#    (ou simplesmente não bundle — Bun roda TS direto)
# RUN bun build src/index.ts --outdir dist --target bun \
#   --external:playwright --external:playwright-core \
#   --external:electron --external:chromium-bidi --external:chromium-bidi/*

# 6) Start — sem bundle:
CMD ["bun", "run", "start"]
