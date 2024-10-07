import { Command } from 'commander'
import { AppContext } from '../../shared/index.js'
import { setMake, getList, setRestore } from '../backup/index.js'
import { BackupsSorted, checkScript, runTests } from '../../helpers/index.js'

export const test = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
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
      '-ud, --use-database <database>',
      'To use this database to create/restore your backups.',
      'default',
    )
    .option(
      '-ub, --use-backup <file name>',
      'To restore this backup file previously uploaded as the current version before to run the tests.',
    )

  cmd.action(async ({ command, backup, restore, useDatabase, useBackup }) => {
    const { destroy } = await context.getBasedClient()

    try {
      if (command) {
        await checkScript(command)
      }

      if (backup && !useBackup) {
        await setMake(context)
      } else if (useBackup) {
        const isCloudFile = useBackup.startsWith('env-db/')

        await setRestore({
          context,
          db: useDatabase ?? 'default',
          file: useBackup,
          isExternalFile: isCloudFile,
          verbose: false,
        })
      }

      await runTests({ context, command })

      if (restore) {
        const backups: BackupsSorted = await getList(context)
        const previousBackup = backups?.sorted?.[useDatabase]?.[1]?.key

        if (previousBackup) {
          await setRestore({
            context,
            db: useDatabase ?? 'default',
            file: previousBackup,
            isExternalFile: false,
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
