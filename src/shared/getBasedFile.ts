import { findUp } from 'find-up'
import { readJSON } from 'fs-extra/esm'
import { bundle } from '@based/bundle'

export const getBasedFile = async (
  file: string[],
): Promise<BasedCli.Context.Project | null> => {
  if (!file || !file.length) {
    return null
  }

  const basedFile = await findUp(file)
  let basedFileContent: BasedCli.Context.Project = {}
  const basedProject: BasedCli.Context.Project = {}

  if (basedFile) {
    if (basedFile.endsWith('.json')) {
      basedFileContent = await readJSON(basedFile)
    } else {
      const bundled = await bundle({
        entryPoints: [basedFile],
      })
      const compiled = bundled.require()

      basedFileContent = compiled.default || compiled
    }

    Object.assign(basedProject, basedFileContent)
    return basedProject
  } else {
    return null
  }
}
