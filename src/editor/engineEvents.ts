/**
 * Central event bus for triggering dataflow execution.
 * Avoids circular dependency between setup.ts and control components.
 */

type Listener = () => void

const listeners: Listener[] = []

export function onExecute(listener: Listener) {
  listeners.push(listener)
  return () => {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }
}

export function triggerExecute() {
  for (const fn of listeners) {
    try { fn() } catch (e) { console.error(e) }
  }
}

export function clearExecuteListeners() {
  listeners.length = 0
}
