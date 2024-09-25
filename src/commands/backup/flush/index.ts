import { Command } from 'commander'
import { BasedClient } from '@based/client'
import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  AppContext,
} from '../../../shared/index.js'
import { getList } from '../list/index.js'

type FlushArgs = {
  db?: string
  file?: string
}

type SetFlushArgs = {
  context: AppContext
  basedClient: BasedClient
  db: string
  org: string
  project: string
  env: string
  cluster: string
}

export const flush =
  (program: Command, context: AppContext) =>
  async ({ db }: FlushArgs) => {
    const { org, project, env, cluster } = program.opts()
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(
      program,
      context,
    )

    context.print.warning(
      `<b>Warning! This action cannot be undone. Proceed only if you know what you're doing.</b>`,
    )

    const doIt: boolean = await context.input.confirm()

    if (!doIt) {
      context.print.fail('Operation cancelled.')
    }

    const backups: BackupsSorted = await getList(context, envHubBasedCloud)
    let { selectedDB } = await backupsSelection({
      context,
      backups,
      selectDB: db,
      selectFile: false,
      showCurrent: false,
    })

    await setFlush({
      context,
      basedClient,
      db: selectedDB,
      org,
      project,
      env,
      cluster,
    })

    destroy()
    return
  }

export const setFlush = async ({
  context,
  basedClient,
  db,
  org,
  project,
  env,
  cluster,
}: SetFlushArgs) => {
  // TODO This function need to be refactored to remove this technical debit non related with the CLI
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  const defaultDBInfo = await basedClient.call('based:db-list')
  const dbInfo = { ...defaultDBInfo[0], name: db }

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

  const doIt: boolean = await context.input.confirm()

  if (!doIt) {
    context.print.fail('Operation cancelled.')
  }

  try {
    context.print.loading('Flushing the current database...')

    const result = await basedClient.call('based:db-flush', { db: dbInfo })

    if (!result.ok) {
      context.print.fail(`Error flushing the current database: '${result}'`)
    }
  } catch (error) {
    context.print.fail(`Error flushing the current database: '${error}'`)
  }

  context.print.success(`Current database flushed successfully!`)
}
