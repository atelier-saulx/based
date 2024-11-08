import type { Command } from 'commander'
import { checkScript, runTests } from '../../helpers/index.js'
import { AppContext } from '../../shared/index.js'
import { getList, setMake, setRestore } from '../backup/index.js'

export const test = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  await context.getProgram()

  const cmd: Command = context.commandMaker('test')

  cmd.action(async (args: Based.Tests.Command) => {
    let { command, backup, restore, db, file, date } = args
    const { destroy } = await context.getBasedClient()
    const { skip } = context.getGlobalOptions()
    db = db !== '' ? db : 'default'

    if (!skip) {
      context.put('globalOptions', { skip: true })
    }

    try {
      if (command) {
        await checkScript(context, command)
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
          const backups: Based.Backups.Sorted = await getList({ context })
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
