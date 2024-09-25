import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  isValidPath,
  replaceTilde,
  sanitizeFileName,
  AppContext,
} from '../../../shared/index.js'
import { join, resolve } from 'node:path'
import { writeFile } from 'fs/promises'
import { BasedClient } from '@based/client'
import { Command } from 'commander'
import { getList } from '../list/index.js'

type DownloadArgs = {
  db?: string
  file?: string
  path?: string
}

type GetDownloadsArgs = {
  context: AppContext
  basedClient: BasedClient
  db: string
  file: string
  path: string
  retry?: number
}

export const download =
  (program: Command, context: AppContext) =>
  async ({ db, file, path }: DownloadArgs) => {
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(
      program,
      context,
    )

    const backups: BackupsSorted = await getList(context, envHubBasedCloud)
    let { selectedFile, selectedDB } = await backupsSelection({
      context,
      backups,
      selectDB: db ?? true,
      selectFile: file ?? true,
    })

    await getDownload({
      context,
      basedClient,
      db: selectedDB,
      file: selectedFile,
      path,
    })

    destroy()
    return
  }

export const getDownload = async ({
  context,
  basedClient,
  db,
  file,
  path,
  retry = 3,
}: GetDownloadsArgs): Promise<void> => {
  let isValid: boolean = false
  const isExternalPath: boolean = path !== undefined && path !== ''

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
      context.print.fail(
        'The specified path is invalid or does not exist. Please provide a valid path.\n',
      )
    }
  } while (!isValid && retry > 0)

  context.print
    .line()
    .info(`<b>Download summary:</b>`)
    .info(`<b>Database:</b> '<cyan>${db}</cyan>'`)
    .info(`<b>Backup file:</b> '<cyan>${file}</cyan>'`)
    .info(`<b>Saving to:</b> '<cyan>${resolve(replaceTilde(path))}</cyan>'`)
    .line()

  if (!isExternalPath) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      context.print.fail('Download cancelled.')
    }
  }

  try {
    context.print.loading('Downloading file...')
    const response = await basedClient.call('based:backups-download', {
      key: file,
    })
    context.print.success()

    try {
      context.print.loading('Saving file...')

      const buffer: Buffer = Buffer.from(response.data)
      await writeFile(replaceTilde(path), buffer)

      context.print.success()
    } catch (error) {
      context.print.fail(`Was not possible to save the file: ${error}`)
    }
  } catch (error) {
    context.print.fail(`Error downloading your file: ${error}`)
  }

  context.print.success(
    `Saved backup in: '<cyan>${resolve(replaceTilde(path))}<cyan>'`,
  )
}
