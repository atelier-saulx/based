import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  isValidPath,
  replaceTilde,
  sanitizeFileName,
  spinner,
} from '../../../shared/index.js'
import { join } from 'node:path'
import { input } from '@inquirer/prompts'
import { writeFile } from 'fs/promises'
import pc from 'picocolors'
import { BasedClient } from '@based/client'
import { Command } from 'commander'
import { getList } from '../list/index.js'

export const download = (program: Command) => async () => {
  const { basedClient, envHubBasedCloud, destroy } = await basedAuth(program)
  const backupsSorted: BackupsSorted = await getList(envHubBasedCloud, false)
  const selectedBackup = await backupsSelection(backupsSorted)

  await getDownload(basedClient, selectedBackup)

  destroy()
  return
}

export const getDownload = async (
  basedClient: BasedClient,
  file: string,
  retry: number = 3,
) => {
  let path: string = ''
  let isValid: boolean = false

  const getPath = async () =>
    await input({
      message:
        'Path to save the backup to: (If the file already exists it will be overwritten)',
      default: join('./', sanitizeFileName(file)),
    })

  do {
    retry--

    path = await getPath()
    isValid = isValidPath(path)
    path = join(path, sanitizeFileName(file))

    if (!isValid) {
      spinner.fail(
        'The specified path is invalid or does not exist. Please provide a valid path.\n',
      )
    }
  } while (!isValid && retry > 0)

  const response = await basedClient.call('based:backups-download', {
    key: file,
  })

  const buffer: Buffer = Buffer.from(response.data)
  await writeFile(replaceTilde(path), buffer)

  console.info(`Saved backup to ${pc.cyan(path)}`)
}
