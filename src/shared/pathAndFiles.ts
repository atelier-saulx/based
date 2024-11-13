import * as fs from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, relative } from 'node:path'

export const fileExtensions = ['ts', 'js', 'json']
export const installableTools = ['typescript', 'vitest', 'biome', 'react']

const isBasedFile = (file: string, type: Based.File) =>
  file.includes(type) && isFormatValid(file)

export const isFormatValid = (file: string) => {
  const extension: Based.FileExtensions = file
    ?.split('.')
    .at(-1) as Based.FileExtensions

  return fileExtensions.includes(extension)
}

export const isSchemaFile = (file: string) =>
  isBasedFile(file, Based.File.SCHEMA)
export const isConfigFile = (file: string) =>
  isBasedFile(file, Based.File.CONFIG)
export const isInfraFile = (file: string) => isBasedFile(file, Based.File.INFRA)

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
  const indent = '  '.repeat(indentLevel) // Define o nível de indentação para o nível atual
  const entries = Object.entries(obj).map(([key, value]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(key)
      ? key
      : `'${key}'` // Verifica se a chave precisa de aspas

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
      return `${indent}${formattedKey}: ${formatAsObject(value, indentLevel + 1)}` // Recursão para objetos aninhados
    }
    return `${indent}${formattedKey}: ${JSON.stringify(value)}`
  })

  const openBraceIndent = '  '.repeat(indentLevel - 1)
  return `{\n${entries.join(',\n')}\n${openBraceIndent}}`
}

export const saveAsFile = async (
  obj: Record<string, unknown>,
  filePath: string,
  format: Based.FileExtensions,
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
    await writeFile(filePath, content, 'utf8')
    return true
  } catch (error) {
    throw new Error(`Failed to save file: ${error}`)
  }
}
