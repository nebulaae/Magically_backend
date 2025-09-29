# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy production dependencies from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy production dependencies from the builder stage
COPY --from=builder /usr/src/app/monitoring ./monitoring

# Copy the compiled code from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy the Swagger specification file
COPY swagger.yaml ./swagger.yaml

# Copy package.json
COPY package.json .

# Copy configuration and public assets
COPY config ./config
COPY public ./public

# Expose the application port
EXPOSE 5000

# Command to run the application
CMD ["node", "dist/index.js"]
