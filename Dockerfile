# ==========================================
# MERX AGRO MONITOR - Dockerfile for CapRover
# ==========================================

FROM node:20-slim AS base

# Install dependencies for Prisma and health checks
RUN apt-get update && apt-get install -y openssl procps && rm -rf /var/lib/apt/lists/*

# ==========================================
# Stage 1: Install dependencies
# ==========================================
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --legacy-peer-deps

# ==========================================
# Stage 2: Build the application
# ==========================================
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Placeholder DATABASE_URL for build time (Prisma needs it to generate client)
# The real DATABASE_URL is set at runtime via CapRover environment variables
ENV DATABASE_URL="postgresql://neondb_owner:npg_EYNaZi9Ag0xj@ep-misty-river-ahqsmptq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" 

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# ==========================================
# Stage 3: Production runner
# ==========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets (create empty dir if not exists)
RUN mkdir -p ./public
COPY --from=builder /app/public ./public/

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for runtime (client and schema for db push)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy start script and set permissions
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x ./start.sh && chown nextjs:nodejs ./start.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check disabled temporarily for debugging
# HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
#   CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application with Prisma db push
CMD ["sh", "start.sh"]
