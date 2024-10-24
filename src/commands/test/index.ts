import { Command } from 'commander'
import { AppContext } from '../../shared/index.js'
import { setMake, getList, setRestore } from '../backup/index.js'
import { BackupsSorted, checkScript, runTests } from '../../helpers/index.js'

export const test = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  await context.getProgram()

  const cmd: Command = context.commandMaker('test')

  cmd.action(async ({ command, backup, restore, db, file, date }) => {
    const { destroy } = await context.getBasedClients()
    const { skip } = context.getGlobalOptions()
    db = db !== '' ? db : 'default'

    if (!skip) {
      context.put('globalOptions', { skip: true })
    }

    try {
      if (command) {
        await checkScript(command)
      }

      if (backup || file) {
        await setMake(context)
      }

      if (file || date) {
        await setRestore({
          context,
          db,
          file,
          date,
          verbose: false,
        })
      }

      await runTests({ context, command })

      if (restore) {
        if (file || date) {
          await setRestore({
            context,
            db,
            file,
            date,
            verbose: false,
          })
        } else {
          const backups: BackupsSorted = await getList(context)
          const previousBackup = backups?.sorted?.[db]?.[1]?.key

          if (previousBackup) {
            await setRestore({
              context,
              db,
              file: previousBackup,
              date: '',
              verbose: false,
            })
          }
        }
      }

      destroy()
    } catch (error) {
      throw new Error(error)
    }
  })
}
