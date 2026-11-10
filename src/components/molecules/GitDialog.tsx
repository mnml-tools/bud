import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { isDialogBackdropClick } from '../../lib/dialog'
import { Button } from '../atoms/Button'

type Props = {
  title: string
  eyebrow?: string
  busy?: boolean
  className?: string
  onDismiss: () => void
  children: ReactNode
}

export function GitDialog({ title, eyebrow, busy = false, className = '', onDismiss, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus()

    return () => dialog.close()
  }, [])

  return createPortal(
    <dialog
      ref={ref}
      className={`modal git-dialog ${className}`}
      aria-labelledby={id}
      onClick={(event) => {
        if (!busy && isDialogBackdropClick(event)) onDismiss()
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onDismiss()
      }}
    >
      <div className="modal-heading">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id={id}>{title}</h2>
        </div>
        <Button type="button" aria-label="Close dialog" disabled={busy} onClick={onDismiss}>
          <X size={16} />
        </Button>
      </div>
      {children}
    </dialog>,
    document.body
  )
}
