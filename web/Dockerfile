FROM node:20-alpine as builder
WORKDIR /app
ARG VITE_API_BASE=/api
ARG VITE_INGEST_BASE=/ingest-api
ARG VITE_MCP_BASE=/mcp
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_INGEST_BASE=$VITE_INGEST_BASE
ENV VITE_MCP_BASE=$VITE_MCP_BASE
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV API_KEY=changeme
ENV QUERY_API_URL=http://query-api:8000
ENV INGEST_API_URL=http://ingestion:8001
ENV MCP_API_URL=http://mcp-server:8002
COPY --from=builder /app/dist ./dist
COPY server.js ./
EXPOSE 5173
CMD ["node", "server.js"]
