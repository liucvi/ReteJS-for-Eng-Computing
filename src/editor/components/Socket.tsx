import { useRef } from 'react'
import { ClassicPreset } from 'rete'
import { getSocketColor } from '../nodes/base'

export function CustomSocket({ data }: { data: ClassicPreset.Socket }) {
  const ref = useRef<HTMLDivElement>(null)
  const color = getSocketColor(data)

  return (
    <div
      ref={ref}
      className="gh-socket"
      style={{ backgroundColor: color, borderColor: color }}
      data-socket-name={data.name}
    />
  )
}
