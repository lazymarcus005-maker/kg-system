FROM node:20-alpine as builder
WORKDIR /app
ARG VITE_API_BASE=http://localhost:8000
ARG VITE_INGEST_BASE=http://localhost:8001
ARG VITE_MCP_BASE=http://localhost:8002
ARG VITE_API_KEY=changeme
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_INGEST_BASE=$VITE_INGEST_BASE
ENV VITE_MCP_BASE=$VITE_MCP_BASE
ENV VITE_API_KEY=$VITE_API_KEY
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g http-server
COPY --from=builder /app/dist ./dist
EXPOSE 5173
CMD ["http-server", "dist", "-p", "5173", "--gzip"]
