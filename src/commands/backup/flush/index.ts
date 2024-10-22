import { AppContext } from '../../../shared/index.js'
import { getList } from '../list/index.js'
import {
  backupsSelection,
  BackupsSorted,
  mountDBName,
} from '../../../helpers/index.js'
import { Command } from 'commander'

export const flush =
  (program: Command) =>
  async ({ db, force }) => {
    const context: AppContext = AppContext.getInstance(program)
    const { cluster, org, env, project } = await context.getProgram()
    const { destroy } = await context.getBasedClients()

    if (!force) {
      context.print.warning(
        `<b>Warning! This action cannot be undone. Proceed only if you know what you're doing.</b>`,
      )

      const doIt: boolean = await context.input.confirm()

      if (!doIt) {
        throw new Error('Operation cancelled.')
      }
    }

    const backups: BackupsSorted = await getList(context)
    let { selectedDB } = await backupsSelection({
      context,
      backups,
      db,
      file: '',
      showCurrent: false,
    })

    try {
      await setFlush({
        context,
        db: selectedDB,
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

export const setFlush = async ({
  context,
  db,
  org,
  project,
  env,
  cluster,
  force,
}: Based.Backups.Flush) => {
  const { basedClient } = await context.getBasedClients()
  // TODO This function need to be refactored to remove this technical debit non related with the CLI
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  const defaultDBInfo = await basedClient.call('based:db-list')
  const dbInfo = mountDBName(defaultDBInfo, db)

  context.print
    .line()
    .info(`<b>Flush summary:</b>`)
    .info(`<b>Cluster:</b> <cyan>${cluster}</cyan>`)
    .info(
      `<b>Org:</b> '<cyan>${org}</cyan>' / <b>Project:</b> '<cyan>${project}</cyan>' / <b>Env:</b> '<cyan>${env}</cyan>'`,
    )
    .info(`<b>Config:</b> '<cyan>${dbInfo.configName}</cyan>'`)
    .info(`<b>Service:</b> '<cyan>@based/env-db</cyan>'`)
    .info(`<b>Database:</b> '<cyan>${dbInfo.name}</cyan>'`)
    .info(`<b>Instance:</b> '<cyan>${dbInfo.instance}</cyan>`)
    .line()

  if (!force) {
    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      throw new Error('Operation cancelled.')
    }
  }

  try {
    context.print.loading('Flushing the current database...')

    const result = await basedClient.call('based:db-flush', { db: dbInfo })

    if (!result.ok) {
      new Error(result)
    }
  } catch (error) {
    new Error(`Error flushing the current database: '${error}'`)
  }

  context.print.stop().success(`Current database flushed successfully!`, true)
}
