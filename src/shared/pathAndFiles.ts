import * as fs from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { BundleResult } from '@based/bundle'
import { getFileByPath } from './getFile.js'

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

export const rel = (str: string) => relative(cwd, str)

export const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

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
      return `${indent}${formattedKey}: ${formatAsObject(value, indentLevel + 1)}`
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
  } catch (err) {
    if (err.code === 'ENOENT') {
      await mkdir(directory, { recursive: true })
    } else {
      throw err
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

export async function getMtimeMs(path: string): Promise<number> {
  const fileStat = await stat(path)
  const { mtimeMs } = fileStat

  return mtimeMs
}

export const findConfigFile = async (
  file: string,
  mapping: Record<string, Based.Deploy.Configs>,
  nodeBundles: BundleResult,
): Promise<Based.Deploy.Configs | undefined> => {
  let currentDir = dirname(resolve(process.cwd(), file))

  while (currentDir !== dirname(currentDir)) {
    if (mapping[currentDir]) {
      if (isConfigFile(file)) {
        const mtimeMs = await getMtimeMs(file)

        if (mapping[currentDir].mtimeMs !== mtimeMs) {
          if (file.endsWith('.json')) {
            mapping[currentDir].config = await getFileByPath(file)
          } else {
            const compiled = nodeBundles.require(file)
            mapping[currentDir].config = compiled.default || compiled
          }

          mapping[currentDir].mtimeMs = mtimeMs
        }
      }

      return mapping[currentDir]
    }

    currentDir = dirname(currentDir)
  }

  return undefined
}
