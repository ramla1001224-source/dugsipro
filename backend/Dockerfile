FROM node:20-slim

# Install OpenSSL, build-essential and PostgreSQL 17 client
# node:20-slim doesn't have build tools, so we install them to compile bcrypt if needed.
RUN apt-get update && apt-get install -y openssl curl ca-certificates gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fSsL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt/ bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y \
    build-essential \
    python3 \
    postgresql-client-17 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Remove postinstall script from package.json to prevent prisma generate during npm ci
RUN npm pkg delete scripts.postinstall

# Install dependencies normally (allows bcrypt to build, but won't trigger prisma generate yet)
RUN npm ci --omit=dev --no-audit --no-fund

# Copy the rest of the application files
COPY . .

# Generate Prisma client explicitly
RUN npx prisma generate

# Expose the port
EXPOSE 4001

# Start the application
CMD ["npm", "start"]
