# Use Node 20 as the base image
FROM node:20-alpine AS base


# Create app directory
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json  ./
RUN npm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Copy necessary files
COPY --from=builder /app/query_craft.sqlite ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Copy the built app
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Copy node_modules
COPY --from=builder /app/node_modules ./node_modules

# Copy .env file
COPY --from=builder /app/.env ./

EXPOSE 3000

ENV PORT 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application using yarn
CMD ["npm", "start"]
