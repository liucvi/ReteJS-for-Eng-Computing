import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function StickyNote({
  title,
  anchor,
  onClose,
  children,
}: {
  title: string
  anchor: { x: number; y: number }
  onClose: () => void
  children: ReactNode
}) {
  return createPortal(
    <div
      className="gh-sticky-note"
      style={{ left: anchor.x, top: anchor.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="gh-sticky-note-header">
        <span>{title}</span>
        <button onClick={onClose}>×</button>
      </div>
      <div className="gh-sticky-note-body">{children}</div>
    </div>,
    document.body
  )
}
