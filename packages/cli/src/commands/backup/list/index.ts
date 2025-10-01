import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'
import { backupsSorting, backupsSummary } from '../../../helpers/index.js'
import { getDownload } from '../download/index.js'
import { setFlush } from '../flush/index.js'
import { setRestore } from '../restore/index.js'

export const list =
  (program: Command) => async (args: Based.Backups.List.Command) => {
    let { limit = 10, sort = 'desc' } = args
    const context: AppContext = AppContext.getInstance(program)
    const { skip } = context.getGlobalOptions()
    const { cluster, org, env, project } = await context.getProgram()
    const { destroy } = await context.getBasedClient()

    sort = sort.toLowerCase()

    const errorMessage = (option: string, value: string | number) => {
      throw new Error(context.i18n('errors.901', option, value))
    }

    if (sort && sort !== 'desc' && sort !== 'asc') {
      errorMessage(
        context.i18n('commands.backups.subCommands.list.validations.sort'),
        sort,
      )
    }

    if (Number.isNaN(Number.parseInt(limit.toString()))) {
      errorMessage(
        context.i18n('commands.backups.subCommands.list.validations.limit'),
        sort,
      )
    }

    limit = Number(limit)

    await getList({ context, limit, sort, verbose: true })

    if (!skip) {
      context.print.line()
      const downloadBackup = await context.input.confirm(
        context.i18n(
          'commands.backups.subCommands.list.methods.downloadConfirmation',
        ),
      )

      if (downloadBackup) {
        try {
          await getDownload({
            context,
          })

          destroy()
          return
        } catch (error) {
          throw new Error(error)
        }
      }

      const restoreBackup: boolean = await context.input.confirm(
        context.i18n(
          'commands.backups.subCommands.list.methods.restoreConfirmation',
        ),
      )

      if (restoreBackup) {
        try {
          await setRestore({
            context,
            verbose: true,
          })

          destroy()
          return
        } catch (error) {
          throw new Error(error)
        }
      }

      const deleteBackup: boolean = await context.input.confirm(
        context.i18n(
          'commands.backups.subCommands.list.methods.flushConfirmation',
        ),
      )

      if (deleteBackup) {
        try {
          await setFlush({
            context,
            org,
            project,
            env,
            cluster,
            force: false,
          })

          destroy()
          return
        } catch (error) {
          throw new Error(error)
        }
      }
    }

    destroy()
    return
  }

export const getList = async (
  args: Based.Backups.List.Get,
): Promise<Based.Backups.Sorted> => {
  const { context, limit = 10, sort = 'desc', verbose = false } = args
  const basedClient = await context.getBasedClient()

  if (verbose) {
    context.spinner.start(
      context.i18n('commands.backups.subCommands.list.methods.searching'),
    )
  }

  const { backups } = await basedClient.call(context.endpoints.BACKUPS_LIST)

  if (!Object.keys(backups).length) {
    throw new Error(
      context.i18n('commands.backups.subCommands.list.methods.noBackups'),
    )
  }

  context.spinner.stop()

  const backupsSorted: Based.Backups.Sorted = backupsSorting(
    backups,
    limit,
    sort,
  )

  backupsSummary(context, backupsSorted, limit, sort, verbose)

  return backupsSorted
}
