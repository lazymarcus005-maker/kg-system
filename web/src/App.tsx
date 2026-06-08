import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DocumentsIngestion from './pages/DocumentsIngestion'
import GraphExplorer from './pages/GraphExplorer'
import EntityManagement from './pages/EntityManagement'
import RelationReview from './pages/RelationReview'
import AskChat from './pages/AskChat'
import RetrievalDebug from './pages/RetrievalDebug'
import ApiMcpMonitor from './pages/ApiMcpMonitor'
import ImportExport from './pages/ImportExport'
import OntologyManagement from './pages/OntologyManagement'
import AuditLog from './pages/AuditLog'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<DocumentsIngestion />} />
          <Route path="graph-explorer" element={<GraphExplorer />} />
          <Route path="entities" element={<EntityManagement />} />
          <Route path="relations" element={<RelationReview />} />
          <Route path="chat" element={<AskChat />} />
          <Route path="debug" element={<RetrievalDebug />} />
          <Route path="monitor" element={<ApiMcpMonitor />} />
          <Route path="import-export" element={<ImportExport />} />
          <Route path="ontology" element={<OntologyManagement />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
