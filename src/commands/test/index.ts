import { Command } from 'commander'
import { AppContext, isCloudFile } from '../../shared/index.js'
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
      '-ud, --use-database <database>',
      "To use this database to create/restore your backups. This option also sets '--no-restore' to 'true'",
      'default',
    )
    .option(
      '-ub, --use-backup <file name>',
      'To restore this backup file previously uploaded as the current version before to run the tests.',
    )

  cmd.action(async ({ command, backup, restore, useDatabase, useBackup }) => {
    const { destroy } = await context.getBasedClients()

    try {
      if (command) {
        await checkScript(command)
      }

      if (backup && !useBackup) {
        await setMake(context)
      } else if (useBackup) {
        await setRestore({
          context,
          db: useDatabase ?? 'default',
          file: useBackup,
          isExternalFile: isCloudFile(useBackup),
          verbose: false,
        })
      }

      await runTests({ context, command })

      if (restore && !useBackup) {
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
