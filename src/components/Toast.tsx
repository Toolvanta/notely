import { AlertCircle, Check, Info } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn } from '../lib/utils'

export function Toast() {
  const { toast, dismissToast } = useApp()
  if (!toast) return null
  const Icon = toast.tone === 'error' ? AlertCircle : toast.tone === 'info' ? Info : Check
  return (
    <div key={toast.id} className={cn('toast', `toast--${toast.tone}`)} role="status" aria-live="polite">
      <Icon size={15} />
      {toast.message}
      {toast.action && (
        <button
          className="toast__action"
          onClick={() => { toast.action!.run(); dismissToast() }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
