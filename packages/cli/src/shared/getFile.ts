import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { findUp } from 'find-up'
import { readJSON } from 'fs-extra/esm'
import { bundle } from '../bundle/index.js'

export const getFile = async (
  files: string[],
): Promise<Based.Context.Project | null> => {
  if (!files || !files.length) {
    return null
  }

  const basedFile = await findUp(files)
  let basedFileContent: Based.Context.Project = {}
  const file: string = basedFile?.split('/').at(-1)

  if (basedFile) {
    if (basedFile.endsWith('.json')) {
      basedFileContent = { ...(await readJSON(basedFile)), file }
    } else {
      const bundled = await bundle({
        entryPoints: [basedFile],
      })
      const compiled = bundled.require()

      basedFileContent = { ...(compiled.default || compiled), file }
    }

    return basedFileContent
  }

  return null
}

export const getFileByPath = async <T>(filePath: string): Promise<T> => {
  try {
    const fullPath = resolve(filePath)
    const data = await readFile(fullPath, 'utf-8')

    return JSON.parse(data)
  } catch {
    return [] as T
  }
}
