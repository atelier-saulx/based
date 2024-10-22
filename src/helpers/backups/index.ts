import {
  differenceInMilliseconds,
  endOfDay,
  format,
  isValid,
  parse,
  parseISO,
} from 'date-fns'
import {
  isCurrentDump,
  AppContext,
  dateAndTime,
  isFileFromCloud,
  dateOnly,
} from '../../shared/index.js'

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
  db?: string
  file?: string
  date?: string
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

const dbSelection = async ({
  context,
  backups,
  db = '',
  verbose = false,
}): Promise<string> => {
  if (!db) {
    const choices: Based.Context.SelectInputItems[] = Object.keys(
      backups.sorted,
    )
      .sort((x, y) => (x == 'default' ? -1 : y == 'default' ? 1 : 0))
      .map((key) => ({ name: key, value: key }))

    db = await context.input.select('Choose database:', choices)
  } else {
    if (verbose) {
      context.print.info(`<b>Selected database:</b> <cyan>${db}</cyan>`)
    }
  }

  if (!backups?.sorted?.[db]?.length) {
    throw new Error(
      `There were no backups found for the selected database: '<b>${db}</b>'.`,
    )
  }

  return db
}

const isBackupExists = (backups: BackupInfo[], selectedFile: string) =>
  isFileFromCloud(selectedFile) &&
  backups.findIndex((file) => file.key === selectedFile)

const findLatestBackup = (backups: BackupInfo[], date: string) => {
  let now = new Date()

  if (date) {
    const parsedDate = parse(date, dateOnly, new Date())

    if (isValid(parsedDate)) {
      now = endOfDay(parsedDate)
    }
  }

  const closestBackup = backups.reduce((closest, backup) => {
    const backupDate = parseISO(backup.lastModified)
    const closestDate = parseISO(closest.lastModified)

    return Math.abs(differenceInMilliseconds(backupDate, now)) <
      Math.abs(differenceInMilliseconds(closestDate, now))
      ? backup
      : closest
  }, backups[0])

  return closestBackup.key
}

const removeTheCurrent = (backups: BackupInfo[]) =>
  backups.filter(({ key }) => !isCurrentDump(key))

const fileSelection = async ({
  context,
  backups,
  sort,
  db = '',
  file = '',
  date = '',
  showCurrent = true,
  verbose = false,
}): Promise<string> => {
  let sortedBackups: BackupInfo[] = backups.sorted[db]

  if (file) {
    if (isBackupExists(sortedBackups, file) > -1) {
      if (verbose) {
        context.print.info(
          `<b>Selected file:</b> <reset><cyan>${file}</cyan></reset>`,
        )
      }

      return file
    }

    throw new Error(`There were no backups found with the name: '${file}'.`)
  }

  if (!showCurrent) {
    sortedBackups = removeTheCurrent(sortedBackups)
  }

  if (!file && !date) {
    const choices: Based.Context.SelectInputItems[] = sortedBackups.map(
      (file: { key: string; lastModified: string }, index, array) => ({
        name: file.key,
        description: `<dim>${index}/${array.length}</dim><white> | <b>Generated at:</b></white> ${format(
          parseISO(file.lastModified),
          dateAndTime,
        )}`,
        value: file.key,
      }),
    )

    file = await context.input.select(
      `Choose backup ${getSortingText(sort)}:`,
      choices,
    )
  } else if (!file && date) {
    file = findLatestBackup(removeTheCurrent(sortedBackups), date)

    if (verbose) {
      context.print.info(
        `<b>Selected file:</b> <reset><cyan>${file}</cyan></reset>`,
      )
    }
  }

  return file
}

export const mountDBName = (db: any, name: string) => {
  if (!Array.isArray(db)) {
    return null
  }

  if (db.length === 1) {
    return { ...db[0], name: 'default' }
  } else if (db.length > 1) {
    return db.filter((elm) => elm.name === name)
  }

  return null
}

export const backupsSelection = async ({
  context,
  backups,
  sort,
  db = '',
  file = '',
  date = '',
  showCurrent = true,
}: BackupSelectionArgs): Promise<BackupSelectionReturn> => {
  const isCloudFile: boolean = isFileFromCloud(file)

  db = await dbSelection({ context, backups, db })

  if (isCloudFile || date) {
    file = await fileSelection({
      context,
      backups,
      sort,
      db,
      file,
      date,
      showCurrent,
    })
  }

  return { selectedDB: db, selectedFile: file }
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
