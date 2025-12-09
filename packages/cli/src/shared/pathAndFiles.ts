import * as fs from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { getFileByPath } from './getFile.js'
import type { BundleResult } from '../bundle/BundleResult.js'

export const fileExtensions = ['ts', 'js', 'json']
export const installableTools = ['typescript', 'vitest', 'biome', 'react']
export const BASED_FILE = 'based'
export const BASED_FILE_BOILERPLATE = `${BASED_FILE}_boilerplate.zip`
export const BASED_FILE_BOILERPLATE_ZIPENTRY = `${BASED_FILE}-boilerplate-main/`

const isBasedFile = (file: string, type: string) =>
  file.includes(type) && isFormatValid(file)

export const isFormatValid = (file: string) => {
  const extension: string = file?.split('.').at(-1)

  return fileExtensions.includes(extension)
}

export const isSchemaFile = (file: string) => isBasedFile(file, 'based.schema')
export const isConfigFile = (file: string) => isBasedFile(file, 'based.config')
export const isInfraFile = (file: string) => isBasedFile(file, 'based.infra')

export const isIndexFile = (file: string) =>
  file === 'index.ts' || file === 'index.js'

export const isCurrentDump = (key: string) => /\/current-dump.rdb$/.test(key)

export const isValidPath = (path: string): boolean => {
  try {
    return fs.existsSync(path) && fs.lstatSync(path).isDirectory()
  } catch {
    return false
  }
}

export const isFileFromCloud = (key: string) =>
  !!(key?.startsWith('env-db/') && key.endsWith('.rdb'))

export const cwd = process.cwd()

export const rel = (path: string) => relative(cwd, path)

export const abs = (path: string, dir: string) =>
  isAbsolute(path) ? path : join(dir, path)

export const sanitizeFileName = (fileName: string) =>
  fileName.replace(/\//gm, '-')

export const replaceTilde = (path: string) =>
  path.replace(/^~(?=$|\/|\\)/, homedir())

export const formatAsObject = (obj: object, indentLevel = 1): string => {
  const indent = '  '.repeat(indentLevel)
  const entries = Object.entries(obj).map(([key, value]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(key)
      ? key
      : `'${key}'`

    if (typeof value === 'string') {
      return `${indent}${formattedKey}: '${value}'`
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return `${indent}${formattedKey}: ${value}`
    }
    if (Array.isArray(value)) {
      const arrayValues = value.map((val) =>
        typeof val === 'string' ? `'${val}'` : val,
      )
      return `${indent}${formattedKey}: [${arrayValues.join(', ')}]`
    }
    if (typeof value === 'object' && value !== null) {
      return `${indent}${formattedKey}: ${formatAsObject(
        value,
        indentLevel + 1,
      )}`
    }
    return `${indent}${formattedKey}: ${JSON.stringify(value)}`
  })

  const openBraceIndent = '  '.repeat(indentLevel - 1)
  return `{\n${entries.join(',\n')}\n${openBraceIndent}}`
}

const ensureDirectoryExists = async (filePath: string): Promise<void> => {
  const directory = dirname(filePath)

  try {
    await stat(directory)
  } catch (error) {
    if (error.code === 'ENOENT') {
      await mkdir(directory, { recursive: true })
    } else {
      throw new Error(error)
    }
  }
}

export const saveAsFile = async (
  obj: Record<string, unknown> | unknown[],
  filePath: string,
  format: 'ts' | 'json' | 'js',
): Promise<boolean> => {
  let content: string

  switch (format) {
    case 'ts':
      content = `export default ${formatAsObject(obj)};\n`
      break

    case 'js':
      content = `module.exports = ${formatAsObject(obj)};\n`
      break

    case 'json':
      content = JSON.stringify(obj, null, 2)
      break

    default:
      throw new Error(`Unsupported format: ${format}`)
  }

  try {
    await ensureDirectoryExists(filePath)

    await writeFile(filePath, content, 'utf8')
    return true
  } catch (error) {
    throw new Error(`Failed to save file: ${error}`)
  }
}

export const getContentType = (extension: string) => {
  switch (extension) {
    case '.html': {
      return 'text/html'
    }

    case '.js': {
      return 'application/javascript'
    }

    case '.css': {
      return 'text/css'
    }

    case '.svg': {
      return 'image/svg+xml'
    }

    case '.wasm': {
      return 'application/wasm'
    }

    case '.json': {
      return 'application/json'
    }

    case '.png': {
      return 'image/png'
    }

    case '.jpg':
    case '.jpeg': {
      return 'image/jpeg'
    }

    case '.gif': {
      return 'image/gif'
    }

    default: {
      return 'application/octet-stream'
    }
  }
}

export const parseNumberAndBoolean = (
  value: string | number | boolean,
): number | boolean => {
  const trimmed = String(value).trim()

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  const num = Number(trimmed)

  if (!Number.isNaN(num)) return num
}

export const stringMaxLength = (strings: string[]) =>
  strings.reduce(
    (acc, string) => (string.length > acc ? string.length : acc),
    0,
  )

export const findConfigFile = async (
  file: string,
  mapping: Record<string, Based.Deploy.Configs>,
  nodeBundles: BundleResult,
  browserBundles: BundleResult,
): Promise<Based.Deploy.Configs | undefined> => {
  if (!file) {
    return
  }

  const relFile = file
  file = abs(file, process.cwd())
  let found = mapping[file]

  if (file.endsWith('.css') || !found) {
    for (const key in browserBundles.result.metafile.inputs) {
      const imports = browserBundles.result.metafile.inputs[key].imports

      if (browserBundles.result.metafile.inputs[key].imports.length) {
        const match = imports.find(({ path }) => path === relFile)

        if (match) {
          found = mapping[abs(key, process.cwd())]
        }
      }
    }
  }

  if (found) {
    if (isConfigFile(file) || isSchemaFile(file) || isInfraFile(file)) {
      if (file.endsWith('.json')) {
        found.config = await getFileByPath(file)
      } else {
        let bundled = nodeBundles.require(file)
        if (bundled) {
          bundled = bundled.default || bundled
          found.config = bundled
        }
      }
    }

    if (isSchemaFile(file)) {
      if (!Array.isArray(found.config)) {
        if (!found.config.schema) {
          found.config = { schema: found.config } as Based.Deploy.ConfigsBase
        }
        found.config = [found.config] as any
      }
    }

    return found
  }

  return undefined
}

export async function streamToUint8Array(
  stream: Readable,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []

  for await (const chunk of stream) {
    if (typeof chunk === 'string') {
      chunks.push(new TextEncoder().encode(chunk))
    } else if (chunk instanceof Uint8Array) {
      chunks.push(chunk)
    } else {
      chunks.push(new Uint8Array(chunk))
    }
  }

  const totalLength = chunks.reduce((sum, curr) => sum + curr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

export const isPathValid = (path: string) => {
  try {
    const parsed = parse(path)
    return !!parsed.root || !!parsed.dir || !!parsed.base
  } catch {
    return false
  }
}

export const ensureDirSafe = async (path: string) => {
  try {
    await mkdir(path, { recursive: true })
    return true
  } catch {
    return false
  }
}

export const resolveBasedFilePath = (path: string) =>
  ['based.ts', 'based.json', 'based.js'].map((file) => abs(file, resolve(path)))
