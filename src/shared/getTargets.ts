import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import parser from 'gitignore-parser'
import { findUp } from 'find-up'
import { isConfigFile, isSchemaFile } from './pathAndFiles.js'

export const getTargets = async () => {
  const ignorePath = await findUp('.gitignore')
  const ignoreFile = ignorePath && (await readFile(ignorePath, 'utf8'))
  const ignore = ignoreFile && parser.compile(ignoreFile)
  const targets: [dir: string, file: string][] = []
  const deny = ignore
    ? (path: string, _file: string) => ignore.denies(path)
    : (_path: string, file: string) => file === 'node_modules'
  let schema: string

  const walk = async (dir = process.cwd()) => {
    const files = await readdir(dir).catch(() => [])
    await Promise.all(
      files.map((file: string) => {
        if (file[0] === '.') {
          return null
        }
        if (!file.includes('.')) {
          const path = join(dir, file)
          if (deny(relative(dirname(ignorePath), path), file)) {
            return null
          }
          return walk(join(dir, file))
        }
        if (isConfigFile(file)) {
          targets.push([dir, file])
        } else if (isSchemaFile(file)) {
          if (schema) {
            throw new Error(`multiple schema's found, at ${schema} and ${file}`)
          }
          schema = join(dir, file)
        }
        return null
      }),
    )
  }

  await walk()

  return { targets, schema }
}
