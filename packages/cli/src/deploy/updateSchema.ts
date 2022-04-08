import based, { Based } from '@based/client'
import { build } from 'esbuild'
import path from 'path'
import { output, DeployOptions } from '.'
import fs from 'fs-extra'
import chalk from 'chalk'
import { fail, prefixSuccess, prefixWarn } from '../tui'
import { wait } from '@saulx/utils'
import ora from 'ora'
import { Config } from '../types'
import checkAuth from '../checkAuth'

export default async function (
  config: Config,
  schemaFiles: string[],
  options: DeployOptions
) {
  // Deploy schema
  const s = Date.now()
  if (schemaFiles.length) {
    const opts =
      config.cluster === 'local'
        ? {
            ...config,
            cluster: 'http://localhost:7022',
          }
        : {
            ...config,
          }

    const token = await checkAuth(options)
    const client = based(opts)
    client.auth(token, { isBasedUser: true })

    let payload: any
    if (/\.js$/.test(schemaFiles[0]) || /\.ts$/.test(schemaFiles[0])) {
      // .js / .ts
      try {
        const outfile = './dist/based/config/schema.js'
        await build({
          entryPoints: [schemaFiles[0]],
          platform: 'node',
          mainFields: ['module', 'main'],
          format: 'cjs',
          bundle: true,
          // write: false,
          outfile,
        })
        payload = require(path.resolve(outfile))
        payload = payload.default ? payload.default : payload
      } catch (err) {
        fail('ESbuild error: ' + err, output, options)
      }
    } else {
      // .json
      try {
        const f = await fs.readFile(schemaFiles[0])
        payload = JSON.parse(f.toString())
      } catch (err) {
        fail(`Cannot parse schema file`, output, options)
      }
    }

    if (payload.length > 0) {
      const spinner = ora(`Updating schema(s)...`).start()
      try {
        await Promise.race([
          Array.isArray(payload)
            ? Promise.all(
                payload.map((schemaConfig) => client.updateSchema(schemaConfig))
              )
            : client.updateSchema(payload),
          wait(8000).then(() => {
            throw new Error(
              'client.updateSchema() timed out. Maybe wrong db name?'
            )
          }),
        ])
        spinner.stop()

        console.info(
          `${prefixSuccess + 'Succesfully updated schema(s) on'} ${chalk.blue(
            `${config.project}/${config.env}`
          )} ${chalk.grey('in ' + (Date.now() - s) + 'ms')}`
        )
      } catch (err) {
        spinner.stop()
        fail('Cannot update schema: ' + err.message, output, options)
      }
    } else {
      console.info(
        prefixWarn + 'Empty schema file, skipping updating configuration'
      )
    }
  }
}
