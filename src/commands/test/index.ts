import type { Command } from 'commander'
import { AppContext } from '../../context/index.js'
import { checkScript, runTests } from '../../helpers/index.js'
import { LINE_UP } from '../../shared/constants.js'
import { getList, setMake, setRestore } from '../backup/index.js'

export const test = async (program: Command): Promise<void> => {
  const context: AppContext = AppContext.getInstance(program)
  const cmd: Command = context.commandMaker('test')

  cmd.action(async (args: Based.Tests.Command) => {
    let { command, backup, restore, db, file, date } = args
    await context.getProgram()
    const { destroy } = await context.getBasedClient()
    db = db !== '' ? db : 'default'

    try {
      if (command) {
        await checkScript(context, command)
      }

      if (backup || file) {
        console.log(LINE_UP)
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
        context.print.line()

        if (file || date) {
          console.log(LINE_UP, LINE_UP)
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
            console.log(LINE_UP, LINE_UP)
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
