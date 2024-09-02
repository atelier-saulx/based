import { findUp } from 'find-up'
import { bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'

let env
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

export const globalOptions = async (program) => {
  if (!process.env.ENV) {
    process.env.ENV = await getEnv()
  }

  const configPath = await findUp(['based.json', 'based.js', 'based.ts'])
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
    .option('-c, --cluster <cluster>', 'Based cluster', args.cluster)
    .requiredOption('-o, --org <org>', 'Organization name', args.org)
    .requiredOption('-p, --project <project>', 'Project name', args.project)
    .requiredOption('-e, --env <env>', 'Environment name', args.env)
    .option('--api-key <api-key>', 'API key for service account')
}
