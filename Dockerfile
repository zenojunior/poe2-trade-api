FROM oven/bun:1.2
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

CMD ["bun", "run", "start"]
