import { Presets } from 'rete-react-plugin'
import type { Schemes } from '../nodes/base'

const { Connection } = Presets.classic

export function CustomConnection({ data }: { data: Schemes['Connection'] }) {
  return (
    <Connection
      data={data}
      styles={() => (
        data.isAutoVariable
          ? `
            stroke: #1f6a55;
            stroke-width: 3px;
            stroke-dasharray: 8 7;
          `
          : `
            stroke: #99a7b8;
            stroke-width: 3px;
            stroke-dasharray: 0;
          `
      )}
    />
  )
}
