import { findUp } from 'find-up'
import { readJSON } from 'fs-extra/esm'
import { bundle } from '@based/bundle'

export const getBasedFile = async (
  files: string[],
): Promise<Based.Context.Project | null> => {
  if (!files || !files.length) {
    return null
  }

  const basedFile = await findUp(files)
  let basedFileContent: Based.Context.Project = {}
  const basedProject: Based.Context.Project = {}
  const file: string = basedFile.split('/').at(-1)

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

    Object.assign(basedProject, basedFileContent)
    return basedProject
  } else {
    return null
  }
}
