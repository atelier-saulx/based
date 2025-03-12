import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { findUp } from 'find-up'
import parser from 'gitignore-parser'

export const gitIgnore = async () => {
  const ignorePath = await findUp('.gitignore')
  let ignoreDir: string = ''

  let ignore: (path: string, _file: string) => boolean = (
    _path: string,
    file: string,
  ) => file === 'node_modules'

  if (ignorePath) {
    ignoreDir = dirname(ignorePath)

    const ignoreFile = ignorePath && (await readFile(ignorePath, 'utf8'))
    const { denies } = ignoreFile && parser.compile(ignoreFile)

    ignore = (path: string, _file: string) => denies(path)
  }

  return { ignore, ignoreDir }
}
