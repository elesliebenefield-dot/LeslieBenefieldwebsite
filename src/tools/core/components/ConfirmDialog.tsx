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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableWithin(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0)
}

export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Remember what opened the dialog, move focus to Cancel, and on close put
  // focus back where it came from. If closing removed that control (e.g.
  // "Start over" resets the page, or a deleted row disappears), focus the
  // first remaining control in its nearest ancestor that's still on the page.
  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null
    const ancestors: Element[] = []
    for (let el = trigger?.parentElement; el && el !== document.body; el = el.parentElement) ancestors.push(el)
    cancelRef.current?.focus()

    return () => {
      if (trigger && trigger.isConnected && trigger.getClientRects().length > 0) {
        trigger.focus()
        return
      }
      for (const ancestor of ancestors) {
        if (!ancestor.isConnected) continue
        const target = focusableWithin(ancestor)[0]
        if (target) {
          target.focus()
          return
        }
      }
    }
  }, [open])

  // Escape cancels; Tab / Shift+Tab cycle within the open dialog.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const items = focusableWithin(dialogRef.current)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && dialogRef.current.contains(active)
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
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
      <div className="tool-confirm-dialog" ref={dialogRef}>
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
