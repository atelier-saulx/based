import * as fs from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { homedir } from 'node:os'
import { writeFile } from 'node:fs/promises'

export const mainFileName: Based.BasedFile = 'based'
export const schemaFileName: Based.BasedFile = `${mainFileName}.schema`
export const configFileName: Based.BasedFile = `${mainFileName}.config`
export const infraFileName: Based.BasedFile = `${mainFileName}.infra`

const isBasedFile = (file: string, type: Based.BasedFile) =>
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
  } catch (err) {
    return false
  }
}

export const isFileFromCloud = (key: string) =>
  key && key.startsWith('env-db/') && key.endsWith('.rdb')

export const cwd = process.cwd()

export const rel = (str: string) => relative(cwd, str)

export const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

export const sanitizeFileName = (fileName: string) =>
  fileName.replace(/\//gm, '-')

export const replaceTilde = (path: string) =>
  path.replace(/^~(?=$|\/|\\)/, homedir())

export const formatAsTypeScriptObject = (obj: Record<string, any>): string => {
  const entries = Object.entries(obj).map(([key, value]) => {
    if (typeof value === 'string') {
      return `${key}: '${value}'`
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return `${key}: ${value}`
    } else {
      return `${key}: ${JSON.stringify(value)}`
    }
  })

  return `{\n  ${entries.join(',\n  ')}\n}`
}

export const saveAsTypeScriptFile = async (
  obj: Record<string, any>,
  filePath: string,
): Promise<boolean> => {
  const content = `export default ${formatAsTypeScriptObject(obj)};\n`

  try {
    await writeFile(filePath, content, 'utf8')

    return true
  } catch (error) {
    throw new Error(error)
  }
}
