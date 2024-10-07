import { format, parseISO } from 'date-fns'
import { isCurrentDump, AppContext, dateAndTime } from '../../shared/index.js'

type BackupInfo = {
  key: string
  lastModified: string
  size: number
}

type BackupsSelection = {
  [key: string]: BackupInfo[]
}

type BackupSelectionArgs = {
  context: AppContext
  backups: BackupsSorted
  selectDB?: string | boolean
  selectFile?: string | boolean
  showCurrent?: boolean
  sort?: string
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
  sort === 'asc' ? '(older to newer)' : '(newer to older)'

export const backupsSummary = (
  context: AppContext,
  values: BackupsSorted,
  limit: number,
  sort: string,
  verbose: boolean,
): void => {
  if (!values.databases || !values.backups) {
    throw new Error(`No backups found.`)
  }

  if (verbose) {
    context.print
      .info(
        `<b>${values.backups}</b> backups found in <b>${values.databases}</b> databases.`,
      )
      .info(
        `Showing <b>${limit === 0 ? 'all' : limit}</b> items <b>${getSortingText(sort)}</b>.`,
      )

    for (const database in values.sorted) {
      context.print
        .separator()
        .info(`Database: <b><cyan>${database}</cyan></b>`)

      for (let i = 0; i < values.sorted[database].length; i++) {
        context.print.info(`File: <dim>${values.sorted[database][i].key}</dim>`)
      }
    }
  }
}

const dbSelection = async (
  context: AppContext,
  backups: BackupsSorted,
  selectedDB?: string,
): Promise<string> => {
  if (!selectedDB) {
    const choices: BasedCli.Context.SelectInputItems[] = Object.keys(
      backups.sorted,
    )
      .sort((x, y) => (x == 'default' ? -1 : y == 'default' ? 1 : 0))
      .map((key) => ({ name: key, value: key }))

    selectedDB = await context.input.select('Choose database:', choices)
  } else {
    context.print.info(`<b>Selected database:</b> <cyan>${selectedDB}</cyan>`)
  }

  if (!backups?.sorted?.[selectedDB]?.length) {
    throw new Error(
      `There were no backups found for the selected database: '<b>${selectedDB}</b>'.`,
    )
  }

  return selectedDB
}

const fileSelection = async (
  context: AppContext,
  backups: BackupsSorted,
  sort: string,
  selectedDB: string,
  selectedFile?: string,
  showCurrent: boolean = true,
): Promise<string> => {
  if (selectedFile) {
    const isBackupExists: number = backups.sorted[selectedDB].findIndex(
      (file) => file.key === selectedFile,
    )

    if (isBackupExists > -1) {
      context.print.info(`<b>Selected file:</b> <b>${selectedFile}</b>`)

      return selectedFile
    }

    throw new Error(
      `There were no backups found with the name: '${selectedFile}'.`,
    )
  }

  if (!showCurrent) {
    backups.sorted[selectedDB] = backups.sorted[selectedDB].filter(
      ({ key }) => !isCurrentDump(key),
    )
  }

  const choices: BasedCli.Context.SelectInputItems[] = backups.sorted[
    selectedDB
  ].map((file: { key: string; lastModified: string }, index, array) => ({
    name: file.key,
    description: `<dim>${index}/${array.length}</dim><white> | <b>Generated at:</b></white> ${format(
      parseISO(file.lastModified),
      dateAndTime,
    )}`,
    value: file.key,
  }))

  selectedFile = await context.input.select(
    `Choose backup ${getSortingText(sort)}:`,
    choices,
  )

  return selectedFile
}

export const backupsSelection = async ({
  context,
  backups,
  sort,
  selectDB = true,
  selectFile = true,
  showCurrent = true,
}: BackupSelectionArgs): Promise<BackupSelectionReturn> => {
  if (typeof selectDB === 'string') {
    selectDB = await dbSelection(context, backups, selectDB)
  } else if (typeof selectDB === 'boolean' && selectDB === true) {
    selectDB = await dbSelection(context, backups, '')
  } else {
    selectDB = ''
  }

  if (typeof selectFile === 'string') {
    selectFile = await fileSelection(
      context,
      backups,
      sort,
      selectDB,
      selectFile,
      showCurrent,
    )
  } else if (typeof selectFile === 'boolean' && selectFile === true) {
    selectFile = await fileSelection(
      context,
      backups,
      sort,
      selectDB,
      '',
      showCurrent,
    )
  } else {
    selectFile = ''
  }

  return { selectedDB: selectDB, selectedFile: selectFile }
}

export const backupsSorting = (
  backups: BackupsSelection,
  limit: number,
  sort: string,
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

    result.sorted[database] = backups[database].sort((a, b) => {
      const dateA: number = new Date(a.lastModified).getTime()
      const dateB: number = new Date(b.lastModified).getTime()

      if (sort === 'asc') {
        return dateA - dateB
      } else if (sort === 'desc') {
        return dateB - dateA
      } else {
        return 0
      }
    })

    if (limit !== 0) {
      result.sorted[database] = backups[database].slice(0, limit)
    }
  }

  return result
}
