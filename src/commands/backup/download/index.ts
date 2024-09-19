import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  isValidPath,
  replaceTilde,
  sanitizeFileName,
  spinner,
} from '../../../shared/index.js'
import { join, resolve } from 'node:path'
import { input } from '@inquirer/prompts'
import confirm from '@inquirer/confirm'
import { writeFile } from 'fs/promises'
import pc from 'picocolors'
import { BasedClient } from '@based/client'
import { Command } from 'commander'
import { getList } from '../list/index.js'

type DownloadArgs = {
  db?: string
  file?: string
  path?: string
}

type GetDownloadsArgs = {
  basedClient: BasedClient
  db: string
  file: string
  path: string
  retry?: number
}

export const download =
  (program: Command) =>
  async ({ db, file, path }: DownloadArgs) => {
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(program)

    const backups: BackupsSorted = await getList(envHubBasedCloud)
    let { selectedFile, selectedDB } = await backupsSelection({
      backups,
      selectDB: db ?? true,
      selectFile: file ?? true,
    })

    await getDownload({ basedClient, db: selectedDB, file: selectedFile, path })

    destroy()
    return
  }

export const getDownload = async ({
  basedClient,
  db,
  file,
  path,
  retry = 3,
}: GetDownloadsArgs): Promise<void> => {
  let isValid: boolean = false
  const isExternalPath: boolean = path !== undefined && path !== ''

  if (isExternalPath) {
    console.info(`📂 ${pc.bold('Selected path:')} ${pc.cyan(path)}`)
  }

  const getPath = async () =>
    await input({
      message:
        'Path to save the backup to: (If the file already exists it will be overwritten)',
      default: './',
    })

  do {
    retry--

    if (!path) {
      path = await getPath()
    }

    isValid = isValidPath(path)
    path = join(path, sanitizeFileName(file))

    if (!isValid) {
      spinner.fail(
        'The specified path is invalid or does not exist. Please provide a valid path.\n',
      )
    }
  } while (!isValid && retry > 0)

  console.info(`\n${pc.bold('Download summary:')}`)
  console.info(`${pc.bold('Database:')} '${pc.cyan(db)}'`)
  console.info(`${pc.bold('Backup file:')} '${pc.cyan(file)}'`)
  console.info(
    `${pc.bold('Saving to:')} '${pc.cyan(resolve(replaceTilde(path)))}'`,
  )

  if (!isExternalPath) {
    const doIt: boolean = await confirm({
      message: 'Continue?',
      default: true,
    })

    if (!doIt) {
      spinner.fail('Download cancelled.')
      process.exit(1)
    }
  }

  try {
    console.log('')
    spinner.start('Downloading file...')
    const response = await basedClient.call('based:backups-download', {
      key: file,
    })
    spinner.succeed()

    try {
      spinner.start('Saving file...')

      const buffer: Buffer = Buffer.from(response.data)
      await writeFile(replaceTilde(path), buffer)

      spinner.succeed()
    } catch (error) {
      spinner.fail(`Was not possible to save the file: ${error}`)
    }
  } catch (error) {
    spinner.fail(`Error downloading your file: ${error}`)
  }

  spinner.succeed(`Saved backup in: '${pc.cyan(resolve(replaceTilde(path)))}'`)
}
