import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../server/generated/prisma/client.js'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type KnowledgeFile = {
  path: string
  name: string
  category: string
  content: string
  summary: string
  metadataJson: Prisma.InputJsonValue
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHUNK_TARGET_LINES = 80
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

async function main() {
  const files = await collectKnowledgeFiles()
  let fileCount = 0
  let chunkCount = 0

  for (const file of files) {
    const record = await prisma.componentFile.upsert({
      where: { path: file.path },
      create: file,
      update: {
        name: file.name,
        category: file.category,
        content: file.content,
        summary: file.summary,
        metadataJson: file.metadataJson,
      },
    })

    await prisma.componentChunk.deleteMany({ where: { fileId: record.id } })
    const chunks = chunkContent(file.content)
    if (chunks.length > 0) {
      await prisma.componentChunk.createMany({
        data: chunks.map((content, index) => ({
          fileId: record.id,
          chunkIndex: index,
          content,
          metadataJson: {
            path: file.path,
            name: file.name,
            category: file.category,
            chunkCount: chunks.length,
          },
        })),
      })
    }

    fileCount++
    chunkCount += chunks.length
  }

  console.log(`Synced ${fileCount} knowledge files and ${chunkCount} chunks.`)
}

async function collectKnowledgeFiles(): Promise<KnowledgeFile[]> {
  const realFiles = await collectRealFiles()
  const virtualFiles = await collectVirtualCanvasDocs()
  return [...realFiles, ...virtualFiles]
}

async function collectRealFiles(): Promise<KnowledgeFile[]> {
  const relativePaths = [
    ...(await filesUnder('src/editor/nodes', ['.ts'])),
    ...(await filesUnder('src/editor/components', ['.tsx'])),
    ...(await filesUnder('src/editor/engine', ['.ts'])),
    'src/editor/controls.ts',
    'src/editor/engineEvents.ts',
    'src/editor/graphPersistence.ts',
    'src/editor/helpDocs.ts',
    'src/editor/helpEvents.ts',
    'src/editor/nodeRegistry.ts',
    'src/editor/projectApi.ts',
    'src/editor/pyodide.ts',
    'src/editor/setup.ts',
    'src/editor/types.ts',
    'src/App.tsx',
    'PROJECT_SUMMARY.md',
    'AGENTS.md',
  ]

  const uniquePaths = [...new Set(relativePaths)].sort()
  const result: KnowledgeFile[] = []

  for (const relativePath of uniquePaths) {
    const absolutePath = path.join(ROOT, relativePath)
    const content = await readFile(absolutePath, 'utf8')
    const category = inferCategory(relativePath)
    const exports = extractExports(content)
    const nodeLabels = extractNodeLabels(content)

    result.push({
      path: normalizePath(relativePath),
      name: path.basename(relativePath),
      category,
      content,
      summary: buildSummary(relativePath, category, exports, nodeLabels),
      metadataJson: {
        kind: 'source-file',
        relativePath: normalizePath(relativePath),
        extension: path.extname(relativePath),
        lineCount: content.split(/\r?\n/).length,
        exports,
        nodeLabels,
      },
    })
  }

  return result
}

async function collectVirtualCanvasDocs(): Promise<KnowledgeFile[]> {
  const setupContent = await readFile(path.join(ROOT, 'src/editor/setup.ts'), 'utf8')
  const nodeRegistry = await readFile(path.join(ROOT, 'src/editor/nodeRegistry.ts'), 'utf8')

  const defaultCanvasDoc = `# Default Canvas: Pump Hydraulic Calculation

The default canvas is built in \`src/editor/setup.ts\` when \`createEditor(container)\` runs.

## Purpose

It demonstrates a water pump and piping network hydraulic calculation workflow.

## Layout

- Column 1: numeric input parameters such as density, viscosity, gravity, flow, pump head, pipe dimensions, local resistance coefficients, and elevation.
- Column 2: suction-line calculations using Pipe Area, Velocity, Reynolds, Friction Factor, Darcy-Weisbach, and Local Resistance nodes.
- Column 3: discharge-line calculations using the same hydraulic chain.
- Column 4: system summary nodes: Total Head, Pump Power, and NPSH.
- Column 5: Report node with a Chinese engineering calculation report template.

## Runtime Notes

- Nodes are added, positioned with \`area.translate(node.id, { x, y })\`, then connected with \`ClassicPreset.Connection\`.
- Results are recomputed through \`DataflowEngine.execute()\`.
- Help text is injected from \`helpDocs.ts\` through \`getNodeHelp(node.label)\`.
`

  const persistenceDoc = `# Canvas Persistence Format

Canvas persistence is implemented in \`src/editor/graphPersistence.ts\`.

## Stored Fields

- \`version\`: persistence format version.
- \`viewport\`: current area transform \`{ x, y, k }\`.
- \`nodes\`: node label, position, serialized controls, and special node data.
- \`connections\`: source node, source output, target node, and target input.

## Special Node Data

- Python Script stores code, input port configs, and output port configs.
- Report stores template text and input port configs.

## Database Target

Saved canvases are stored in \`projects.graphJson\` as JSONB.

## Current Limitation

Node IDs are remapped during load. Connections are restored using the saved old-id to new-node map.
`

  return [
    {
      path: 'virtual://canvas/default-pump-hydraulic-demo.md',
      name: 'Default Pump Hydraulic Demo Canvas',
      category: 'canvas',
      content: defaultCanvasDoc,
      summary: 'Default Rete canvas built by setup.ts for pump and piping hydraulic calculation.',
      metadataJson: {
        kind: 'canvas-doc',
        sourceFiles: ['src/editor/setup.ts', 'PROJECT_SUMMARY.md'],
        setupLineCount: setupContent.split(/\r?\n/).length,
      },
    },
    {
      path: 'virtual://canvas/persistence-format.md',
      name: 'Canvas Persistence Format',
      category: 'canvas',
      content: persistenceDoc,
      summary: 'Description of how graphPersistence.ts serializes and restores Rete canvases.',
      metadataJson: {
        kind: 'canvas-doc',
        sourceFiles: ['src/editor/graphPersistence.ts', 'src/editor/components/Toolbar.tsx'],
        registeredComponentLabels: extractNodeLabels(nodeRegistry),
      },
    },
  ]
}

async function filesUnder(relativeDir: string, extensions: string[]): Promise<string[]> {
  const absoluteDir = path.join(ROOT, relativeDir)
  const entries = await readdir(absoluteDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const child = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await filesUnder(child, extensions))
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(normalizePath(child))
    }
  }

  return files
}

function inferCategory(relativePath: string): string {
  const normalized = normalizePath(relativePath)
  if (normalized.startsWith('src/editor/nodes/')) return `node:${path.basename(normalized, path.extname(normalized))}`
  if (normalized.startsWith('src/editor/components/')) return 'ui-component'
  if (normalized.startsWith('src/editor/engine/')) return 'engine'
  if (normalized.endsWith('helpDocs.ts')) return 'help-docs'
  if (normalized.endsWith('nodeRegistry.ts')) return 'component-registry'
  if (normalized.endsWith('graphPersistence.ts')) return 'canvas-persistence'
  if (normalized.endsWith('setup.ts')) return 'canvas-setup'
  if (normalized.endsWith('PROJECT_SUMMARY.md')) return 'project-doc'
  return 'editor-support'
}

function extractExports(content: string): string[] {
  const matches = content.matchAll(/export\s+(?:abstract\s+)?(?:class|function|const|type|interface)\s+([A-Za-z0-9_]+)/g)
  return [...matches].map((match) => match[1]).filter(Boolean)
}

function extractNodeLabels(content: string): string[] {
  const labels = new Set<string>()

  for (const match of content.matchAll(/super\(['"`]([^'"`]+)['"`]\)/g)) {
    if (!match[1].includes('${')) labels.add(match[1])
  }

  for (const match of content.matchAll(/label:\s*['"`]([^'"`]+)['"`]/g)) {
    if (!match[1].includes('${')) labels.add(match[1])
  }

  return [...labels].sort()
}

function buildSummary(relativePath: string, category: string, exports: string[], nodeLabels: string[]): string {
  const parts = [`${normalizePath(relativePath)} (${category})`]
  if (nodeLabels.length > 0) parts.push(`nodes: ${nodeLabels.slice(0, 8).join(', ')}`)
  if (exports.length > 0) parts.push(`exports: ${exports.slice(0, 8).join(', ')}`)
  return parts.join(' | ')
}

function chunkContent(content: string): string[] {
  const lines = content.split(/\r?\n/)
  const chunks: string[] = []

  for (let index = 0; index < lines.length; index += CHUNK_TARGET_LINES) {
    const chunk = lines.slice(index, index + CHUNK_TARGET_LINES).join('\n').trim()
    if (chunk) chunks.push(chunk)
  }

  return chunks
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
