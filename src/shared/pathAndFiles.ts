import * as fs from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { homedir } from 'node:os'

export const isSchemaFile = (file: string) =>
  file === 'based.schema.js' ||
  file === 'based.schema.json' ||
  file === 'based.schema.ts'

export const isConfigFile = (file: string) =>
  file === 'based.config.js' ||
  file === 'based.config.json' ||
  file === 'based.config.ts'

export const isIndexFile = (file: string) =>
  file === 'index.ts' || file === 'index.js'

// export const isCurrentDump = (key: string) => /\/current-dump.rdb$/.test(key)

export const isValidPath = (filePath: string): boolean => {
  try {
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isDirectory()
  } catch (err) {
    return false
  }
}

export const cwd = process.cwd()

export const rel = (str: string) => relative(cwd, str)

export const abs = (str: string, dir: string) =>
  isAbsolute(str) ? str : join(dir, str)

export const sanitizeFileName = (fileName: string) =>
  fileName.replace(/\//gm, '-')

export const replaceTilde = (path: string) =>
  path.replace(/^~(?=$|\/|\\)/, homedir())
