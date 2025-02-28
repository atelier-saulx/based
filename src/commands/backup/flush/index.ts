import type { Command } from 'commander'
import { AppContext } from '../../../context/index.js'
import { backupsSelection, mountDBName } from '../../../helpers/index.js'
import { getList } from '../list/index.js'

export const flush =
  (program: Command) => async (args: Based.Backups.Flush.Command) => {
    const { db, force } = args
    const context: AppContext = AppContext.getInstance(program)
    const { cluster, org, env, project } = await context.getProgram()
    const { destroy } = await context.getBasedClient()

    if (!force) {
      context.print.warning(context.i18n('methods.warning'))

      const doIt: boolean = await context.input.confirm()

      if (!doIt) {
        throw new Error(context.i18n('methods.aborted'))
      }
    }

    try {
      await setFlush({
        context,
        db,
        org,
        project,
        env,
        cluster,
        force,
      })

      destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const setFlush = async (args: Based.Backups.Flush.Set) => {
  const { context, db, org, project, env, cluster, force } = args
  const basedClient = await context.getBasedClient()
  const backups: Based.Backups.Sorted = await getList({ context })
  const { selectedDB } = await backupsSelection({
    context,
    backups,
    db,
    file: '',
    showCurrent: false,
  })

  // TODO This function need to be refactored to remove this technical debit non related with the CLI
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  const defaultDBInfo = await basedClient.call(context.endpoints.DB_LIST)
  const dbInfo = mountDBName(defaultDBInfo, selectedDB)

  context.print
    .line()
    .info(
      context.i18n('commands.backups.subCommands.flush.methods.summary.header'),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.flush.methods.summary.projectInfo',
        cluster,
        org,
        project,
        env,
      ),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.flush.methods.summary.config',
        dbInfo.configName,
      ),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.flush.methods.summary.service',
      ),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.flush.methods.summary.database',
        dbInfo.name,
      ),
    )
    .info(
      context.i18n(
        'commands.backups.subCommands.flush.methods.summary.instance',
        dbInfo.instance,
      ),
    )
    .line()

  if (!force) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw new Error(context.i18n('methods.aborted'))
    }
  }

  try {
    context.spinner.start(
      context.i18n('commands.backups.subCommands.flush.methods.flushing'),
    )

    const result = await basedClient.call(context.endpoints.DB_FLUSH, {
      db: dbInfo,
    })

    if (!result.ok) {
      throw new Error(result)
    }
  } catch (error) {
    throw new Error(context.i18n('errors.906', error))
  }

  context.print.success(
    context.i18n('commands.backups.subCommands.flush.methods.success'),
    true,
  )
}
