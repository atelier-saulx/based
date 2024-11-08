import * as fs from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { homedir } from 'node:os'
import { writeFile } from 'node:fs/promises'

export const mainFileName: Based.File = 'based'
export const schemaFileName: Based.File = `${mainFileName}.schema`
export const configFileName: Based.File = `${mainFileName}.config`
export const infraFileName: Based.File = `${mainFileName}.infra`

const isBasedFile = (file: string, type: Based.File) =>
  file === `${type}.js` || file === `${type}.json` || file === `${type}.ts`

export const isSchemaFile = (file: string) => isBasedFile(file, schemaFileName)
export const isConfigFile = (file: string) => isBasedFile(file, configFileName)
export const isInfraFile = (file: string) => isBasedFile(file, infraFileName)

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
  !!(key && key.startsWith('env-db/') && key.endsWith('.rdb'))

export const cwd = process.cwd()

export const rel = (str: string) => relative(cwd, str)

export const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

export const sanitizeFileName = (fileName: string) =>
  fileName.replace(/\//gm, '-')

export const replaceTilde = (path: string) =>
  path.replace(/^~(?=$|\/|\\)/, homedir())

export const formatAsObject = (
  obj: Record<string, any>,
  indentLevel = 1,
): string => {
  const indent = '  '.repeat(indentLevel) // Define o nível de indentação para o nível atual
  const entries = Object.entries(obj).map(([key, value]) => {
    const formattedKey = /^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(key)
      ? key
      : `'${key}'` // Verifica se a chave precisa de aspas

    if (typeof value === 'string') {
      return `${indent}${formattedKey}: '${value}'`
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return `${indent}${formattedKey}: ${value}`
    } else if (Array.isArray(value)) {
      const arrayValues = value.map((val) =>
        typeof val === 'string' ? `'${val}'` : val,
      )
      return `${indent}${formattedKey}: [${arrayValues.join(', ')}]`
    } else if (typeof value === 'object' && value !== null) {
      return `${indent}${formattedKey}: ${formatAsObject(value, indentLevel + 1)}` // Recursão para objetos aninhados
    } else {
      return `${indent}${formattedKey}: ${JSON.stringify(value)}`
    }
  })

  const openBraceIndent = '  '.repeat(indentLevel - 1)
  return `{\n${entries.join(',\n')}\n${openBraceIndent}}`
}

export const saveAsFile = async (
  obj: Record<string, any>,
  filePath: string,
  format: Based.Extensions,
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
