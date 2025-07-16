import { readdir } from 'fs/promises'
import { join } from 'path'

export type FindResult = {
  path: string
  file: string
  dir: string
  ext: string
}

export const find = async (
  cwd: string,
  targets: Set<string>,
  cb: (res: FindResult) => Promise<any>,
): Promise<void> => {
  const noop = () => {}
  const walk = async (dir: string): Promise<any> => {
    const files = await readdir(dir)
    await Promise.all(
      files.map(async (file) => {
        if (targets.has(file)) {
          const path = join(dir, file)
          return cb({
            file,
            dir,
            path,
            ext: file.substring(file.lastIndexOf('.') + 1),
          })
        }
        return walk(join(dir, file)).catch(noop)
      }),
    )
  }

  await walk(cwd)
}
