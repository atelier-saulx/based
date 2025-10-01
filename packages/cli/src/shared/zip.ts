import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path, { join, relative } from 'node:path'
import AdmZip from 'adm-zip'
import type { AppContext } from '../context/AppContext.js'

export const extractZipEntry = async (
  context: AppContext,
  sourcePath: string,
  entryPoint: string,
  destinationPath: string,
): Promise<boolean> => {
  try {
    if (!existsSync(sourcePath)) {
      context.print.error(context.i18n('errors.915'))
      return false
    }

    const zip = new AdmZip(sourcePath)
    const entries = zip.getEntries()

    const filteredEntries = entries.filter((entry) =>
      entry.entryName.startsWith(entryPoint),
    )

    if (!filteredEntries.length) {
      context.print.error(context.i18n('errors.916'))
      return false
    }

    for (const entry of filteredEntries) {
      const relativePath = relative(entryPoint, entry.entryName)
      const outputPath = join(destinationPath, relativePath)

      if (entry.isDirectory) {
        mkdirSync(outputPath, { recursive: true })
      } else {
        mkdirSync(path.dirname(outputPath), { recursive: true })
        writeFileSync(outputPath, entry.getData())
      }
    }

    return true
  } catch (error) {
    context.print.error(context.i18n('errors.902', error))

    return false
  }
}
