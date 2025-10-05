FROM oven/bun:1.2
WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install

COPY . .

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

USER root
RUN bunx playwright install --with-deps chromium
USER bun

CMD ["bun", "run", "start"]
