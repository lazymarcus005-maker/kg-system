const STORAGE_KEY = 'kg_audit'
const MAX_ENTRIES = 100

export interface AuditEntry {
  timestamp: string
  action: string
  entity: string
  details: string
  type: 'approve' | 'reject' | 'ingest' | 'edit' | 'merge'
}

export function logEvent(entry: Omit<AuditEntry, 'timestamp'>): void {
  const entries = readLog()
  const newEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  }
  const updated = [newEntry, ...entries].slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // ignore storage quota errors
  }
}

export function readLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuditEntry[]) : []
  } catch {
    return []
  }
}

export function clearLog(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function exportLogAsJson(): string {
  return JSON.stringify(readLog(), null, 2)
}
