import { Command } from 'commander'
import { AppContext, dateOnly } from '../../shared/index.js'
import { setMake, getList, setRestore } from '../backup/index.js'
import { BackupsSorted, checkScript, runTests } from '../../helpers/index.js'

export const test = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  await context.getProgram()

  const cmd: Command = program
    .command('test')
    .description("Run your application's tests using your environment data.")
    .option(
      '-co, --command <command>',
      "To run a specific command in your 'package.json'.",
      'test',
    )
    .option(
      '-nb, --no-backup',
      'To not make a new backup before running the tests.',
    )
    .option(
      '-nr, --no-restore',
      'To not restore the backup after running the tests.',
    )
    .option(
      '--db <db>',
      'The DB instance name to be used to create/restore your backups.',
      'default',
    )
    .option(
      '--file <file>',
      "Use an '.rdb' backup file to restore your data to the current version before running the tests. You can specify a file path or a file name from a backup previously uploaded to the cloud. This option also sets '--no-backup' to 'false'.",
    )
    .option(
      `--date <${dateOnly.toLowerCase()}>`,
      'You can provide a date to use the most recent backup created on that date.',
    )

  cmd.action(async ({ command, backup, restore, db, file, date }) => {
    const { destroy } = await context.getBasedClients()

    try {
      if (command) {
        await checkScript(command)
      }

      if (backup || file) {
        await setMake(context)
      }

      if (file) {
        await setRestore({
          context,
          db: db ?? 'default',
          file,
          date,
          verbose: false,
        })
      }

      await runTests({ context, command })

      if (restore) {
        const backups: BackupsSorted = await getList(context)
        const previousBackup = backups?.sorted?.[db]?.[1]?.key

        if (previousBackup) {
          await setRestore({
            context,
            db: db ?? 'default',
            file: previousBackup,
            date,
            verbose: false,
          })
        }
      }

      destroy()
    } catch (error) {
      throw new Error(error)
    }
  })
}
