import { Send, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import api from '../lib/api'
import type { ChatCompletionMessage, KgSource } from '../lib/types'

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
  kg_sources?: KgSource[]
  sourcesOpen?: boolean
}

const SUGGESTIONS = [
  'List all entities in the knowledge graph',
  'What relationships exist between nodes?',
  'Summarize the documents ingested so far',
]

export default function AskChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I can help you query the knowledge graph. Ask me anything about entities, relationships, or the system.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setError('')

    const userMsg: DisplayMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history for context
    const history: ChatCompletionMessage[] = messages
      .concat(userMsg)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await api.post('/v1/chat/completions', {
        model: 'kg-graphrag',
        messages: history,
        stream: false,
      })
      const answer: string = res.data.choices?.[0]?.message?.content ?? '(empty response)'
      const kg_sources: KgSource[] = res.data.kg_sources ?? []
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answer, kg_sources, sourcesOpen: false },
      ])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed'
      setError(msg)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${msg}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const toggleSources = (idx: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, sourcesOpen: !m.sourcesOpen } : m))
    )
  }

  return (
    <div className="p-8 h-screen flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-graph-900 mb-2">Ask / Chat Playground</h1>
        <p className="text-graph-600">Test GraphRAG queries and knowledge graph exploration</p>
      </div>

      <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-2xl">
                <div
                  className={`px-4 py-3 rounded-lg text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-graph-100 text-graph-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* KG Sources panel */}
                {msg.kg_sources && msg.kg_sources.length > 0 && (
                  <div className="mt-1">
                    <button
                      onClick={() => toggleSources(idx)}
                      className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {msg.sourcesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{msg.kg_sources.length} graph source{msg.kg_sources.length > 1 ? 's' : ''}</span>
                    </button>

                    {msg.sourcesOpen && (
                      <div className="mt-2 space-y-2">
                        {msg.kg_sources.map((src, si) => (
                          <div
                            key={si}
                            className="text-xs bg-blue-50 border border-blue-200 rounded p-2"
                          >
                            <span className="font-semibold text-blue-700 uppercase">{src.type}</span>
                            {src.query && (
                              <pre className="mt-1 font-mono text-blue-900 whitespace-pre-wrap break-all">
                                {src.query}
                              </pre>
                            )}
                            {src.fallback && (
                              <span className="text-blue-500 italic"> (vector fallback)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-graph-100 text-graph-600 px-4 py-3 rounded-lg text-sm flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-graph-400 border-t-graph-700 rounded-full animate-spin" />
                <span>Querying knowledge graph…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-graph-200 p-6">
          {error && (
            <p className="text-xs text-red-600 mb-3">⚠️ {error}</p>
          )}
          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={loading}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-graph-50 rounded-lg hover:bg-graph-100 transition-colors text-graph-700 border border-graph-200 disabled:opacity-50"
              >
                <Zap size={14} />
                <span>{s}</span>
              </button>
            ))}
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Type your question here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-graph-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
