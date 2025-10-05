FROM oven/bun:1.2
WORKDIR /app

# se tiver bun.lockb, copie junto (use *. para não falhar quando não existir)
COPY package.json bun.lockb* ./
RUN bun install

COPY . .

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Playwright precisa rodar como root para instalar deps do SO
USER root
RUN bunx playwright install --with-deps chromium
USER bun

CMD ["bun", "run", "start"]
