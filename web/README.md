# KG System Web Control Panel

A comprehensive React + TypeScript web interface for managing the Knowledge Graph system. This control panel provides a unified dashboard for document ingestion, graph exploration, entity/relation management, and GraphRAG querying.

## 📋 Features

### Core Pages (MVP - 7 pages)

1. **Dashboard** - System overview with key metrics and health status
2. **Documents / Ingestion** - Upload, manage, and monitor document ingestion
3. **Graph Explorer** - Visualize and explore the knowledge graph
4. **Entity Management** - Review, edit, and manage knowledge entities
5. **Relation Review** - Approve or reject AI-extracted relationships
6. **Ask / Chat Playground** - Test GraphRAG queries interactively
7. **Settings** - Configure system parameters and integrations

### Extended Pages (Phase 2 - 3 pages)

8. **Retrieval Debug** - Debug and analyze retrieval pipeline performance
9. **Import / Export** - Backup and restore knowledge graph data
10. **API / MCP Monitor** - Monitor API endpoints and MCP tool availability

### Future Pages (Phase 3 - 2 pages)

11. **Ontology Management** - Manage node types and relation types
12. **Audit Log / Versioning** - Track changes and version history

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn
- Docker (optional, for containerized deployment)

### Development

```bash
cd web
npm install
npm run dev
```

The app will start at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

### Docker

```bash
# Build the Docker image
docker build -t kg-web .

# Run with docker-compose
docker-compose up web --profile dev
```

## 📁 Project Structure

```
web/
├── src/
│   ├── pages/              # 12 main page components
│   │   ├── Dashboard.tsx
│   │   ├── DocumentsIngestion.tsx
│   │   ├── GraphExplorer.tsx
│   │   ├── EntityManagement.tsx
│   │   ├── RelationReview.tsx
│   │   ├── AskChat.tsx
│   │   ├── RetrievalDebug.tsx
│   │   ├── ApiMcpMonitor.tsx
│   │   ├── ImportExport.tsx
│   │   ├── OntologyManagement.tsx
│   │   ├── AuditLog.tsx
│   │   └── Settings.tsx
│   ├── components/         # Reusable components
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── StatCard.tsx
│   ├── App.tsx            # Main app with routing
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── Dockerfile
└── .env.example
```

## 🎨 Styling

The project uses **Tailwind CSS** for styling with a custom color scheme (`graph-*`) optimized for knowledge graph visualization.

### Custom Colors

- `graph-50` to `graph-900` - Primary color scale
- Additional semantic colors for status indicators (green, red, yellow, blue, purple)

## 🔌 API Integration

All API calls should go to the backend at `${VITE_API_URL}` (defaults to `http://localhost:8000`).

Expected backend endpoints:

- `POST /api/documents/upload` - Upload PDF documents
- `GET /api/graph/nodes` - Fetch graph nodes
- `POST /api/chat/completions` - GraphRAG queries
- `GET /api/entities` - Fetch entities
- `POST /api/relations/approve` - Approve relations
- (See Settings page for full configuration)

## 🛠 Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **UI Framework**: Tailwind CSS 3
- **Routing**: React Router v6
- **State Management**: Zustand (optional, can be added)
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Charts**: Recharts (optional, can be added)

## 📝 Environment Variables

Create a `.env.local` file based on `.env.example`:

```env
VITE_API_URL=http://localhost:8000
VITE_APP_TITLE=KG System
VITE_LOG_LEVEL=info
```

## 🧪 Testing & Type Checking

```bash
# Type check
npm run type-check

# Lint
npm run lint
```

## 📖 Development Guidelines

- Use TypeScript for type safety
- Follow the existing component structure
- Keep pages focused on their specific function
- Use Tailwind utility classes for styling
- Create reusable components in `src/components/`
- Store shared logic in a `src/hooks/` or `src/lib/` folder if needed

## 🚢 Deployment

The web app can be deployed in multiple ways:

1. **Static hosting** (Vercel, Netlify, GitHub Pages)
   ```bash
   npm run build
   # Deploy the `dist/` folder
   ```

2. **Docker container** (as part of docker-compose)
   ```bash
   docker-compose up web --profile dev
   ```

3. **Traditional Node.js server**
   ```bash
   npm install -g serve
   npm run build
   serve -s dist
   ```

## 📊 Performance Optimization

- Code-splitting via Vite
- Lazy loading for routes
- Optimized images and assets
- CSS/JS minification in production

## 🤝 Contributing

When adding new features:

1. Create the page component in `src/pages/`
2. Add routing in `App.tsx`
3. Update the Sidebar navigation
4. Style with Tailwind CSS
5. Add type definitions for API responses

## 📞 Support

For issues or questions about the KG System architecture, see the main [README.md](../README.md)

## 📄 License

Same as the main KG System project.
