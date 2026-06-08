import { AlertCircle, X } from 'lucide-react'

interface Props {
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}

export default function ErrorBanner({ message, onDismiss, onRetry }: Props) {
  return (
    <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
      <div className="flex items-center space-x-2">
        <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
        <span className="text-sm text-red-800">{message}</span>
      </div>
      <div className="flex items-center space-x-2 ml-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium text-red-700 hover:text-red-900 underline"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="p-1 hover:bg-red-100 rounded transition-colors">
            <X size={16} className="text-red-600" />
          </button>
        )}
      </div>
    </div>
  )
}
