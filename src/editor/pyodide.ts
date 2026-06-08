let pyodideInstance: any = null
let pyodideReady = false
let pyodideError = ''
let loadPromise: Promise<any> | null = null

export async function initPyodide(): Promise<any> {
  if (pyodideReady && pyodideInstance) return pyodideInstance
  if (pyodideError) throw new Error(pyodideError)
  if (loadPromise) return loadPromise

  loadPromise = doLoad()
  return loadPromise
}

async function doLoad(): Promise<any> {
  const indexURL = '/pyodide/'

  try {
    const pyodideModule = await Promise.race([
      import(/* @vite-ignore */ `${indexURL}pyodide.mjs`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Pyodide load timeout (30s)')), 30000)
      ),
    ])

    const loadPyodide = pyodideModule.loadPyodide
    if (!loadPyodide) throw new Error('Pyodide loader not available')

    pyodideInstance = await loadPyodide({
      indexURL,
      stdout: () => {},
      stderr: () => {},
    })

    pyodideReady = true
    pyodideError = ''
    return pyodideInstance
  } catch (err) {
    pyodideError = err instanceof Error ? err.message : String(err)
    pyodideReady = false
    throw err
  } finally {
    loadPromise = null
  }
}

export function getPyodide(): any {
  return pyodideInstance
}

export function isPyodideReady(): boolean {
  return pyodideReady
}

export function getPyodideError(): string {
  return pyodideError
}

export function resetPyodide() {
  pyodideInstance = null
  pyodideReady = false
  pyodideError = ''
  loadPromise = null
}
