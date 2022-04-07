import { program } from 'commander'
import { command } from './command'
import checkAuth from './checkAuth'
import makeClient from './makeClient'

// import inquirer from 'inquirer'
import findConfig from './findConfig'
import chalk from 'chalk'

// const {
//   sourceOrg,
//   sourceProject,
//   sourceEnv,
//   sourceDbName,
//   sourceKey,
//   destOrg,
//   destProject,
//   destEnv,
//   destDbName,
//   destKey,
// } = payload

// make functional version, something like
// based migrate --cluster local --org saulx -p chat -e dev --target-org saulx --target-project chat --target-env prod

// restart no dump works!
// do: send backup to both -> migrate from source to dest -> restart no dump -> should be done.
command(program.command('migrate'))
  .requiredOption('-do, --dest-org <dest-org-name>', 'Name of destination org')
  .requiredOption(
    '-dp, --dest-project <dest-project-name>',
    'Name of destination project'
  )
  .requiredOption(
    '-de, --dest-env <dest-env-name>',
    'Name of destination environment'
  )
  .requiredOption('-k, --key <file-name>', 'Name of the backup to migrate')
  .option(
    '-db, --database <name>',
    "Name of source database, can be omitted if 'default'"
  )
  .option(
    '-ddb, --dest-database <dest-database-name>',
    "Name of destination database, can be omitted if 'default'"
  ) // these are all mandatory so maybe not 'option'? check commander docs
  .action(async (options) => {
    let {
      org,
      project,
      env,
      cluster,
      basedFile,
      database,
      destOrg,
      destProject,
      destEnv,
      destDatabase,
      key,
    } = options

    const config = (await findConfig(basedFile)) || {}

    if (!cluster) {
      if (config.cluster) {
        cluster = config.cluster
      }
    }

    let incomplete = false

    if (!org) {
      if (config.org) {
        org = config.org
      } else {
        console.info(chalk.red('Please provide an org'))
        incomplete = true
      }
    }

    if (!project) {
      if (config.project) {
        project = config.project
      } else {
        console.info(chalk.red('Please provide a project'))
        incomplete = true
      }
    }

    if (!env) {
      if (config.env) {
        env = config.env
      } else {
        console.info(chalk.red('Please provide an env'))
        incomplete = true
      }
    }

    if (incomplete) {
      return
    }

    const token = await checkAuth(options)
    // const s = Date.now()

    const client = makeClient(cluster)
    client.auth(token)
    try {
      const response = await client.call('migrateBackup', {
        sourceOrg: org,
        sourceProject: project,
        sourceEnv: env,
        sourceDbName: database,
        destOrg,
        destProject,
        destEnv,
        destDbName: destDatabase,
        fileKey: key,
      })

      console.info(response.msg)
    } catch (e) {
      console.error(e)
    }

    process.exit()
  })
