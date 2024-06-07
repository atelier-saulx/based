import { Command } from 'commander'
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { OutputFile, bundle } from '@based/bundle'
import { readJSON, ensureJSON } from 'fs-extra/esm'
import { isIndexFile } from './utils.js'
import { getTargets } from './getTargets.js'
import based from '@based/client'
import input from '@inquirer/input'
import pc from 'picocolors'
import { homedir } from 'node:os'

const cwd = process.cwd()
const rel = (str) => relative(cwd, str)

const persistPath = join(homedir(), '.based/cli')
const authPath = join(persistPath, 'auth.json')

const login = async (program: Command) => {
  const { cluster, org, env, project } = program.opts()
  const admin = based({
    org: 'saulx',
    env: 'platform',
    project: 'based-cloud',
    name: '@based/admin-hub',
    cluster,
  })

  let users: {
    email: string
    userId: string
    token: string
    ts: number
  }[] = await readJSON(authPath).catch(() => [])
  let user

  if (users.length) {
    const lastUser = users.sort((a, b) => b?.ts - a?.ts)[0]
    await admin
      .setAuthState({
        ...lastUser,
        type: 'based',
      })
      .then(() => {
        user = lastUser
      })
      .catch(() => {
        users = users.filter((user) => user !== lastUser)
      })
  }

  if (!user) {
    const email = await input({
      message: 'email pls',
      default: 'youri@saulx.com',
      validate(email) {
        const at = email.lastIndexOf('@')
        const dot = email.lastIndexOf('.')
        return at > 0 && at < dot - 1 && dot < email.length - 2
      },
    })

    await admin.call('login', {
      email,
      skipEmailForTesting: cluster === 'local',
      code: 'xxx',
    })

    const { userId, token } = await admin.once('authstate-change')
    users.push({ email, userId, token, ts: Date.now() })
    await ensureJSON(authPath, users)
  }

  await admin.setAuthState({
    userId: 'us49320a7b',
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1czQ5MzIwYTdiIiwiaWF0IjoxNzE3NzU2MjEwLCJleHAiOjE3MTgzNjEwMTB9.zof9vqaDX8oa8ttuHtSUQ7JRDhn8hltptKHW_FhSzfQ',
    persistent: true,
    type: 'based',
  })

  console.log(
    await admin.setAuthState({
      userId: 'us49320a7b',
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1czQ5MzIwYTdiIiwiaWF0IjoxNzE3NzU2MjEwLCJleHAiOjE3MTgzNjEwMTB9.zof9vqaDX8oa8ttuHtSUQ7JRDhn8hltptKHW_FhSzfQ',
      persistent: true,
      type: 'based',
    }),
  )

  console.log('??', admin.authState)

  // await admin.call('login', {
  //   email: 'youri@saulx.com',
  //   skipEmailForTesting: cluster === 'local',
  //   code: 'xxx',
  // })

  console.log(admin.authState, await admin.once('authstate-change'))

  const client = based({
    cluster,
    org,
    env,
    project,
  })

  return { admin, client }
}

export const deploy = async (program: Command) => {
  const cmd = program.command('deploy')

  cmd
    .option('-w, --watch', 'watch mode')
    .option(
      '-f, --functions <functions...>',
      'function names to deploy (variadic)',
    )
    .action(
      async ({ functions, watch }: { functions: string[]; watch: boolean }) => {
        try {
          const { targets, schema } = await getTargets()
          const configPaths = targets.map(([dir, file]) => join(dir, file))
          const includeSchema = schema && !functions

          // bundle the configs and schema (if necessary)
          const configBundles = await bundle({
            entryPoints: includeSchema ? [schema, ...configPaths] : configPaths,
          })

          // read configs
          let configs: {
            config: {
              type: string
              name: string
              public: boolean
              main?: string
            }
            path: string
            dir: string
            index?: string
          }[] = await Promise.all(
            configPaths.map(async (path, index) => {
              const dir = targets[index][0]
              if (path.endsWith('.json')) {
                return { dir, path, config: await readJSON(path) }
              }
              const compiled = configBundles.require(path)
              return { dir, path, config: compiled.default || compiled }
            }),
          )

          if (functions) {
            // only include selected functions
            const filter = new Set(functions)
            configs = configs.filter(({ config }) => filter.has(config.name))
          }

          if (!configs.length) {
            console.info(
              pc.yellow(
                `No ${functions ? 'matching ' : ''}function configs found`,
              ),
            )
            return
          }

          if (includeSchema) {
            const compiledSchema = configBundles.require(schema)
            let schemaObj = compiledSchema.default || compiledSchema
            if (!Array.isArray(schemaObj)) {
              if (!schemaObj.schema) {
                schemaObj = { schema: schemaObj }
              }
              schemaObj = [schemaObj]
            }
            console.info(
              `${pc.blue('schema')} ${schemaObj.map(({ db = 'default' }) => db).join(', ')} ${pc.dim(rel(schema))}`,
            )
          }

          // log matching configs and find function indexes
          await Promise.all(
            configs.map(async (item) => {
              const { config, path } = item
              const access = config.public ? pc.cyan('public') + ' ' : ''
              const type = pc.magenta(config.type || 'function')
              const name = config.name
              const file = pc.dim(rel(path))
              console.info(`${type} ${name} ${access}${file}`)

              const files = await readdir(item.dir)
              for (const file of files) {
                if (isIndexFile(file)) {
                  item.index = join(item.dir, file)
                  break
                }
              }
            }),
          )

          // validate and create bundle entryPoints
          const paths: Record<string, string> = {}
          const entryPoints = includeSchema ? [schema] : []

          for (const { config, path, index } of configs) {
            const existingPath = paths[config.name]
            if (existingPath) {
              console.info(
                pc.yellow(
                  `Found multiple configs for "${config.name}". Cancelling deploy...`,
                ),
              )
              return
            }
            paths[config.name] = path
            if (!index) {
              console.info(
                pc.yellow(
                  `Could not find index.ts or index.js for "${config.name}". Cancelling deploy...`,
                ),
              )
              return
            }

            if (config.type === 'app') {
              if (!config.main) {
                console.info(
                  pc.yellow(
                    `No "main" field defined for "${config.name}" of type "app". Cancelling deploy...`,
                  ),
                )
                return
              }
              entryPoints.push(config.main)
            }

            entryPoints.push(index)
          }

          // build the functions
          const bundles = await bundle({
            entryPoints,
          })

          const handled = new Set<OutputFile>()

          for (const { index } of configs) {
            const outputFile = bundles.js(index)

            // console.log('--->', outputFile, watch)

            // const res = await envAdmin.stream('based:set-function', {
            //   contents: fn.contents,
            //   payload: {
            //     checksum,
            //     config: configObj,
            //   },
            // })
          }

          // console.log(result.metafile.outputs)

          // for (const outputFile of result.outputFiles) {

          // }
        } catch (e) {
          console.error(pc.red(e.message))
        }
      },
    )
}
