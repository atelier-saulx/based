import { Command } from 'commander'
import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  replaceTilde,
  spinner,
} from '../../../shared/index.js'
import { BasedClient } from '@based/client'
import pc from 'picocolors'
import confirm from '@inquirer/confirm'
import { pathExists } from 'fs-extra'
import { resolve } from 'node:path'
import { formatISO } from 'date-fns/formatISO'
import { isValid } from 'date-fns/isValid'

type ShowArgs = {
  before: string
  after: string
  functions: string
  checksum: number
  level: string
  service: string
}

export const show =
  (program: Command) =>
  async ({
    before,
    after,
    checksum,
    service,
    level,
    functions,
  }: ShowArgs): Promise<void> => {
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(program)
    let formatedBefore: string = before
    let formatedAfter: string = after
    let validChecksum: number = checksum

    if (before) {
      formatedBefore = formatISO(before)
      if (!isValid(formatedBefore)) {
        spinner.fail(
          `The ${pc.bold('before')} date is not valid: '${pc.bold(pc.cyan(before))}'. Check it and try again.`,
        )
      }
    }

    if (after) {
      formatedAfter = formatISO(after)
      if (!isValid(formatedAfter)) {
        spinner.fail(
          `The ${pc.bold('after')} date is not valid: '${pc.bold(pc.cyan(after))}'. Check it and try again.`,
        )
      }
    }

    if (checksum) {
      validChecksum = parseInt(checksum.toString())
      if (isNaN(validChecksum)) {
        spinner.fail(
          `The ${pc.bold('checksum')} is not valid: '${pc.bold(pc.cyan(checksum))}'. Check it and try again.`,
        )
      }
    }

    console.log()
    destroy()
    return
  }
//
// export const getShow = async ({
//   basedClient,
//   db,
//   file,
//   isExternalFile,
// }: SetRestoreArgs) => {}
