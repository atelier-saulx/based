import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'
import { backupsSelection } from '../../../helpers/index.js'
import {
  isValidPath,
  replaceTilde,
  sanitizeFileName,
} from '../../../shared/index.js'
import { getList } from '../list/index.js'

export const download =
  (program: Command) => async (args: Based.Backups.Download.Command) => {
    const { db, file, date, path } = args
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { destroy } = await context.getBasedClient()

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

export const getDownload = async (
  args: Based.Backups.Download.Get,
): Promise<void> => {
  let { context, db, file, date, path } = args
  let retry: number = 3
  let isValid: boolean = false
  const basedClient = await context.getBasedClient()
  const { skip } = context.getGlobalOptions()
  const isExternalPath: boolean = path !== undefined && path !== ''

  const backups: Based.Backups.Sorted = await getList({ context })
  const { selectedFile, selectedDB } = await backupsSelection({
    context,
    backups,
    db,
    file,
    date,
  })

  if (isExternalPath) {
    context.print.log(context.i18n('alias.isExternalPath', path))
  }

  const getPath = async () =>
    await context.input.default(
      context.i18n('commands.backups.subCommands.download.methods.getPath'),
      './',
    )

  do {
    retry--

    if (!path) {
      path = await getPath()
    }

    isValid = isValidPath(path)
    path = resolve(join(path, sanitizeFileName(selectedFile)))

    if (!isValid) {
      if (!retry) {
        throw new Error(context.i18n('errors.904'))
      }

      context.print.log(context.i18n('errors.904'), true)
      path = ''
    }
  } while (!isValid && retry > 0)

  context.print
    .line()
    .info(
      context.i18n(
        'commands.backups.subCommands.download.methods.summary.header',
      ),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.download.methods.summary.database',
        selectedDB,
      ),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.download.methods.summary.file',
        selectedFile,
      ),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.download.methods.summary.path',
        path,
      ),
    )
    .line()

  if (!skip) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw new Error(context.i18n('methods.aborted'))
    }
  }

  try {
    context.spinner.start(context.i18n('methods.downloading'))

    const response = await basedClient.call(
      context.endpoints.BACKUPS_DOWNLOAD,
      {
        key: selectedFile,
      },
    )

    context.spinner.stop()

    try {
      context.spinner.start(context.i18n('methods.savingFile'))

      const buffer: Buffer = Buffer.from(response.data)
      await writeFile(replaceTilde(path), buffer)

      context.spinner.stop()
    } catch {
      throw new Error(context.i18n('errors.902', path))
    }
  } catch {
    throw new Error(context.i18n('errors.905'))
  }

  context.print.success(context.i18n('methods.savedFile', path), true)
}
