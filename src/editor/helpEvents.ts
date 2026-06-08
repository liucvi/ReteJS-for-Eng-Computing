type Listener = (nodeId: string) => void

const listeners: Listener[] = []

export const helpEvents = {
  onShowHelp(l: Listener) {
    listeners.push(l)
  },
  offShowHelp(l: Listener) {
    const idx = listeners.indexOf(l)
    if (idx >= 0) listeners.splice(idx, 1)
  },
  showHelp(nodeId: string) {
    listeners.forEach((l) => l(nodeId))
  },
}
