# Stage 1: Base image
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Stage 2: Development
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run" ,"dev"]

# Stage 3: Production build and run
FROM base AS production
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["npm", "start"]
