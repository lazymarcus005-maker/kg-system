import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'

interface Node {
  id: string
  name: string
  type: string
}

interface Edge {
  source: string
  target: string
  relation: string
}

interface GraphVisualizationProps {
  nodes: Node[]
  edges: Edge[]
  height?: string
}

const TYPE_COLORS: Record<string, string> = {
  Standard: '#3b82f6',
  Clause: '#8b5cf6',
  Requirement: '#ec4899',
  Control: '#f59e0b',
  Component: '#10b981',
  TestCase: '#06b6d4',
  Evidence: '#14b8a6',
  Role: '#f97316',
  Process: '#eab308',
  Artifact: '#a78bfa',
  Constraint: '#64748b',
  Unknown: '#6b7280',
  Entity: '#9ca3af',
}

export default function GraphVisualization({ nodes, edges, height = '600px' }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return

    // Create a set of node IDs for quick lookup
    const nodeIds = new Set(nodes.map(n => n.id))

    // Convert to Cytoscape format, filtering edges to only include those where both nodes exist
    const cyNodes = nodes.map(node => ({
      data: {
        id: node.id,
        label: node.name,
        type: node.type,
      },
    }))

    const cyEdges = edges
      .filter(e => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target))
      .map(edge => ({
        data: {
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          label: edge.relation,
        },
      }))

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': function(ele: any) {
              return TYPE_COLORS[ele.data('type')] || TYPE_COLORS.Unknown
            },
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'color': '#fff',
            'font-weight': 'bold',
            'width': '50px',
            'height': '50px',
            'text-max-width': '45px',
            'text-wrap': 'wrap',
            'text-overflow-wrap': 'whitespace',
            'border-width': '2px',
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'edge',
          style: {
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#999999',
            'line-color': '#cccccc',
            'width': '2px',
            'label': 'data(label)',
            'font-size': '11px',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
          } as any,
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        animationDuration: 0,
        nodeSpacing: 50,
        padding: 20,
      } as any,
    })

    // Fit to view after layout
    setTimeout(() => cy.fit(), 100)

    return () => {
      cy.destroy()
    }
  }, [nodes, edges])

  if (nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        className="border border-gray-200 rounded-lg bg-gray-50"
      >
        <p className="text-gray-500">Ingest documents first to build the knowledge graph</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="border border-gray-200 rounded-lg bg-white"
    />
  )
}
