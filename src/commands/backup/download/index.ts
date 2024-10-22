import {
  isValidPath,
  replaceTilde,
  sanitizeFileName,
  AppContext,
} from '../../../shared/index.js'
import { join, resolve } from 'node:path'
import { writeFile } from 'fs/promises'
import { getList } from '../list/index.js'
import { backupsSelection, BackupsSorted } from '../../../helpers/index.js'
import { Command } from 'commander'

export const download =
  (program: Command) =>
  async ({ db, file, path, date }) => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { destroy } = await context.getBasedClients()

    try {
      await getDownload({
        context,
        db,
        file,
        date,
        path,
      })

      destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const getDownload = async ({
  context,
  db = '',
  file = '',
  path = '',
  date = '',
  retry = 3,
}: Based.Backups.Downloads): Promise<void> => {
  let isValid: boolean = false
  const { basedClient } = await context.getBasedClients()
  const { skip } = context.getGlobalOptions()
  const isExternalPath: boolean = path !== undefined && path !== ''

  const backups: BackupsSorted = await getList(context)
  let { selectedFile, selectedDB } = await backupsSelection({
    context,
    backups,
    db,
    file,
    date,
  })

  if (isExternalPath) {
    context.print.info(`<b>Selected path:</b> <cyan>${path}</cyan>`)
  }

  const getPath = async () =>
    await context.input.default(
      'Path to save the backup to: (If the file already exists it will be overwritten)',
      './',
    )

  do {
    retry--

    if (!path) {
      path = await getPath()
    }

    isValid = isValidPath(path)
    path = join(path, sanitizeFileName(file))

    if (!isValid) {
      throw new Error(
        'The specified path is invalid or does not exist. Please provide a valid path.',
      )
    }
  } while (!isValid && retry > 0)

  context.print
    .line()
    .info(`<b>Download summary:</b>`)
    .info(`<b>Database:</b> <reset><cyan>${selectedDB}</cyan></reset>`)
    .info(`<b>Backup file:</b> <reset><cyan>${selectedFile}</cyan></reset>`)
    .info(
      `<b>Saving to:</b> <reset><cyan>${resolve(replaceTilde(path), selectedFile)}</cyan></reset>`,
    )
    .line()

  if (!skip) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw new Error('Download cancelled.')
    }
  }

  try {
    context.print.loading('Downloading file...')
    const response = await basedClient.call('based:backups-download', {
      key: selectedFile,
    })
    context.print.stop()

    try {
      context.print.loading('Saving file...')

      const buffer: Buffer = Buffer.from(response.data)
      await writeFile(replaceTilde(path), buffer)

      context.print.stop()
    } catch (error) {
      new Error(`Was not possible to save the file: ${error}`)
    }
  } catch (error) {
    throw new Error(`Error downloading your file: ${error}`)
  }

  context.print.success(
    `Saved backup in: <reset><cyan>${resolve(replaceTilde(path), selectedFile)}</cyan></reset>`,
    true,
  )
}
