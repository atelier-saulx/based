import { select, Separator } from '@inquirer/prompts'
import pc from 'picocolors'
import { format, parseISO } from 'date-fns'
import { spinner } from './spinner.js'

type BackupInfo = {
  key: string
  lastModified: string
  size: number
}

export type BackupsSorted = {
  databases: number
  backups: number
  sorted: BackupsSelectionParams
}

type BackupsSelectionParams = {
  [key: string]: BackupInfo[]
}

export const backupsSummary = (values: BackupsSorted, verbose: boolean) => {
  if (!values.databases || !values.backups) {
    spinner.fail(`No backups found.`)
    process.exit(1)
  } else {
    console.info(
      `✨ ${pc.bold(values.backups)} backups found in ${pc.bold(values.databases)} databases.`,
    )
  }

  if (verbose) {
    for (const database in values.sorted) {
      console.info(' ──────────────')
      console.info(`📖  Database: ${pc.bold(pc.cyan(database))}`)

      for (let i = 0; i < values.sorted[database].length; i++) {
        console.info(`Backup: ${pc.dim(values.sorted[database][i].key)}`)
      }
    }
  }
}

export const backupsSelection = async (backups: BackupsSorted) => {
  const selectedDB: string = await select<string>({
    message: 'Choose database:',
    choices: Object.keys(backups.sorted)
      .sort((x, y) => (x == 'default' ? -1 : y == 'default' ? 1 : 0))
      .map((key) => ({ name: key, value: key })),
  })

  const selectedBackup: string = await select<string>({
    message: 'Choose backup: (newer to older)',
    choices: [
      ...backups.sorted[selectedDB].map(
        (o: { key: string; lastModified: string }) => ({
          name: o.key,
          description: `${pc.bold(pc.white('  Generated at:'))} ${format(
            parseISO(o.lastModified),
            'dd/MM/yyyy - HH:mm:ss',
          )}`,
          value: o.key,
        }),
      ),
      new Separator(),
    ],
  })

  return selectedBackup
}

export const backupsSorting = (
  backups: BackupsSelectionParams,
): BackupsSorted => {
  const result: BackupsSorted = {
    databases: 0,
    backups: 0,
    sorted: {},
  }

  for (const database in backups) {
    result.databases++
    result.backups = backups[database].length
    result.sorted[database] = backups[database].sort().reverse()
  }

  return result
}
