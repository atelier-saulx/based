import { findUp } from 'find-up'
import { bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'
import { Command } from 'commander'

let env: string

const getEnv = async (): Promise<string> => {
  if (env === undefined) {
    env = global.ENV
    if (!env && typeof process === 'object') {
      env = process.env.ENV
      if (!env) {
        const { exec } = await import('node:child_process')
        env = await new Promise((resolve) => {
          return exec('git branch --show-current', (err, stdout) => {
            resolve(err ? '' : stdout.trim())
            if (err) {
              resolve('')
            }
          })
        })
      }
    }
    env ||= ''
  }

  return env
}

export const globalOptions = async (program: Command) => {
  if (!process.env.ENV) {
    process.env.ENV = await getEnv()
  }

  const configPath = await findUp(['based.json', 'based.js', 'based.json'])
  const args: {
    cluster: string
    project?: string
    org?: string
    env?: string
  } = {
    cluster: 'production',
  }

  if (configPath) {
    if (configPath.endsWith('.json')) {
      Object.assign(args, await readJSON(configPath))
    } else {
      const bundled = await bundle({
        entryPoints: [configPath],
      })
      const compiled = bundled.require()
      Object.assign(args, compiled.default || compiled)
    }
  }

  program
    .option(
      '-c, --cluster <cluster>',
      'Define the cluster to use',
      args.cluster,
    )
    .requiredOption('-o, --org <org>', 'Specify the organization', args.org)
    .requiredOption(
      '-p, --project <project>',
      'Specify the project name',
      args.project,
    )
    .requiredOption(
      '-e, --env <env>',
      'Specify witch environment (can be a name or "#branch" if you want to deploy by branch)',
      args.env,
    )
    .option(
      '-aK, --api-key <api-key>',
      'API Key generated on Based.io for Service Account',
    )
}
