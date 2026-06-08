import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string
  change: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'purple' | 'yellow'
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  yellow: 'bg-yellow-50 text-yellow-600',
}

export default function StatCard({ title, value, change, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-graph-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-graph-900">{value}</p>
          <p className="text-xs text-graph-500 mt-2">{change}</p>
        </div>
        <div className={clsx('p-3 rounded-lg', colorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}
