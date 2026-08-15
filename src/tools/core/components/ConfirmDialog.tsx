import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="tool-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="tool-confirm-dialog">
        <p id="confirm-title" className="tool-confirm-title">{title}</p>
        <p className="tool-confirm-body">{body}</p>
        <div className="tool-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="tool-confirm-cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="tool-confirm-proceed"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
