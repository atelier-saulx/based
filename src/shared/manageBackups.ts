import { select, Separator } from '@inquirer/prompts'
import pc from 'picocolors'
import { format, parseISO } from 'date-fns'
import { spinner } from './spinner.js'
import { isCurrentDump } from './pathAndFiles.js'

type BackupInfo = {
  key: string
  lastModified: string
  size: number
}

type BackupsSelection = {
  [key: string]: BackupInfo[]
}

type BackupSelectionArgs = {
  backups: BackupsSorted
  selectDB?: string | boolean
  selectFile?: string | boolean
  showCurrent?: boolean
  sort?: BasedCli.Backups.List.Args['sort']
}

export type BackupsSorted = {
  databases: number
  backups: number
  sorted: BackupsSelection
}

type BackupSelectionReturn = {
  selectedDB: string
  selectedFile: string
}

const getSortingText = (sort: string): string =>
  sort === 'ASC' ? '(older to newer)' : '(newer to older)'

export const backupsSummary = (
  values: BackupsSorted,
  limit: number,
  sort: BasedCli.Backups.List.Args['sort'],
  verbose: boolean,
): void => {
  if (!values.databases || !values.backups) {
    spinner.fail(`No backups found.`)
    process.exit(1)
  } else {
    console.info(
      `\n✨ ${pc.bold(values.backups)} backups found in ${pc.bold(values.databases)} databases. Showing ${pc.bold(limit)} items ${pc.bold(getSortingText(sort))}.`,
    )
  }

  if (verbose) {
    for (const database in values.sorted) {
      console.info(' ──────────────')
      console.info(`📖  Database: ${pc.bold(pc.cyan(database))}`)

      for (let i = 0; i < values.sorted[database].length; i++) {
        console.info(`File: ${pc.dim(values.sorted[database][i].key)}`)
      }
      console.info(' ──────────────')
    }
  }
}

const dbSelection = async (
  backups: BackupsSorted,
  selectedDB?: string,
): Promise<string> => {
  if (!selectedDB) {
    selectedDB = await select<string>({
      message: 'Choose database:',
      choices: Object.keys(backups.sorted)
        .sort((x, y) => (x == 'default' ? -1 : y == 'default' ? 1 : 0))
        .map((key) => ({ name: key, value: key })),
    })
  } else {
    console.info(`📖 ${pc.bold('Selected database:')} ${pc.cyan(selectedDB)}`)
  }

  if (!backups?.sorted?.[selectedDB]?.length) {
    spinner.fail(
      `There were no backups found for the selected database: '${pc.bold(selectedDB)}'.`,
    )
    process.exit(1)
  }

  return selectedDB
}

const fileSelection = async (
  backups: BackupsSorted,
  sort: BasedCli.Backups.List.Args['sort'],
  selectedDB: string,
  selectedFile?: string,
  showCurrent: boolean = true,
): Promise<string> => {
  if (selectedFile) {
    const isBackupExists: number = backups.sorted[selectedDB].findIndex(
      (file) => file.key === selectedFile,
    )

    if (isBackupExists > -1) {
      console.info(`💾 ${pc.bold('Selected file:')} ${pc.cyan(selectedFile)}`)

      return selectedFile
    }

    spinner.fail(
      `There were no backups found with the name: '${selectedFile}'.`,
    )
    process.exit(1)
  }

  if (!showCurrent) {
    backups.sorted[selectedDB] = backups.sorted[selectedDB].filter(
      ({ key }) => !isCurrentDump(key),
    )
  }

  selectedFile = await select<string>({
    message: `Choose backup ${getSortingText(sort)}:`,
    choices: [
      ...backups.sorted[selectedDB].map(
        (file: { key: string; lastModified: string }) => ({
          name: file.key,
          description: `${pc.bold(pc.white('  Generated at:'))} ${format(
            parseISO(file.lastModified),
            'dd/MM/yyyy - HH:mm:ss',
          )}`,
          value: file.key,
        }),
      ),
      new Separator(),
    ],
  })

  return selectedFile
}

export const backupsSelection = async ({
  backups,
  sort,
  selectDB = true,
  selectFile = true,
  showCurrent = true,
}: BackupSelectionArgs): Promise<BackupSelectionReturn> => {
  if (typeof selectDB === 'string') {
    selectDB = await dbSelection(backups, selectDB)
  } else if (typeof selectDB === 'boolean' && selectDB === true) {
    selectDB = await dbSelection(backups, '')
  } else {
    selectDB = ''
  }

  if (typeof selectFile === 'string') {
    selectFile = await fileSelection(
      backups,
      sort,
      selectDB,
      selectFile,
      showCurrent,
    )
  } else if (typeof selectFile === 'boolean' && selectFile === true) {
    selectFile = await fileSelection(backups, sort, selectDB, '', showCurrent)
  } else {
    selectFile = ''
  }

  return { selectedDB: selectDB, selectedFile: selectFile }
}

export const backupsSorting = (
  backups: BackupsSelection,
  limit: number,
  sort: BasedCli.Backups.List.Args['sort'],
): BackupsSorted => {
  const result: BackupsSorted = {
    databases: 0,
    backups: 0,
    sorted: {},
  }

  if (!Object.keys(backups).length) {
    return result
  }

  for (const database in backups) {
    result.databases++
    result.backups = backups[database].length

    result.sorted[database] = backups[database]
      .sort((a, b) => {
        const dateA: number = new Date(a.lastModified).getTime()
        const dateB: number = new Date(b.lastModified).getTime()

        if (sort === 'ASC') {
          return dateA - dateB
        } else if (sort === 'DESC') {
          return dateB - dateA
        } else {
          return 0
        }
      })
      .slice(0, limit)
  }

  return result
}
