import { Command } from 'commander'
import { BasedClient } from '@based/client'
import {
  backupsSelection,
  BackupsSorted,
  basedAuth,
  spinner,
} from '../../../shared/index.js'
import confirm from '@inquirer/confirm'
import pc from 'picocolors'
import { getList } from '../list/index.js'

type FlushArgs = {
  db?: string
  file?: string
}

type SetFlushArgs = {
  basedClient: BasedClient
  db: string
  org: string
  project: string
  env: string
  cluster: string
}

export const flush =
  (program: Command) =>
  async ({ db }: FlushArgs) => {
    const { org, project, env, cluster } = program.opts()
    const { basedClient, envHubBasedCloud, destroy } = await basedAuth(program)

    console.info(
      `⚠️ ${pc.bold("Warning! This action cannot be undone. Proceed only if you know what you're doing.")}`,
    )

    const doIt: boolean = await confirm({
      message: 'Continue?',
      default: true,
    })

    if (!doIt) {
      spinner.fail('Operation cancelled.')
      process.exit(1)
    }

    const backups: BackupsSorted = await getList(envHubBasedCloud, false)
    let { selectedDB } = await backupsSelection({
      backups,
      selectDB: db,
      selectFile: false,
      showCurrent: false,
    })

    await setFlush({
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

  console.info(`\n${pc.bold('Flush summary:')}`)
  // TODO Fix the value coming from 'db'
  // https://linear.app/1ce/issue/BASED-284/refactoring-baseddb-list-cloud-function
  console.info(`${pc.bold('Cluster:')} ${pc.cyan(cluster)}`)
  console.info(
    `${pc.bold('Org:')} ${pc.cyan(org)} / ${pc.bold('Project:')} ${pc.cyan(project)} / ${pc.bold('Env:')} ${pc.cyan(env)}`,
  )
  console.info(`${pc.bold('Config:')} ${pc.cyan(dbInfo.configName)}`)
  console.info(`${pc.bold('Service:')} ${pc.cyan('@based/env-db')}`)
  console.info(`${pc.bold('Database:')} '${pc.cyan(dbInfo.name)}'`)
  console.info(`${pc.bold('Instance:')} ${pc.cyan(dbInfo.instance)}\n`)

  const doIt: boolean = await confirm({
    message: 'Continue?',
    default: true,
  })

  if (!doIt) {
    spinner.fail('Operation cancelled.')
    process.exit(1)
  }

  try {
    console.log('')
    spinner.start('Flushing the current database...')

    const result = await basedClient.call('based:db-flush', { db: dbInfo })

    if (!result.ok) {
      spinner.fail(`Error flushing the current database: '${result}'`)
      process.exit(1)
    }
  } catch (error) {
    spinner.fail(`Error flushing the current database: '${error}'`)
    process.exit(1)
  }

  spinner.succeed(`Current database flushed successfully!`)
}
