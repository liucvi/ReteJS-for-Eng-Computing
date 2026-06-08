import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { StickyNote } from './StickyNote'

export function HelpModal({
  title,
  markdown,
  onClose,
  anchor,
}: {
  title: string
  markdown: string
  onClose: () => void
  anchor: { x: number; y: number }
}) {
  return (
    <StickyNote title={title} anchor={anchor} onClose={onClose}>
      <div className="gh-help-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || '暂无帮助文档。'}</ReactMarkdown>
      </div>
    </StickyNote>
  )
}
