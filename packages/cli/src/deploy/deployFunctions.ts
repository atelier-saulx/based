import { Based } from '@based/client'
import { BasedFunctionConfig } from './finder'
import { printEmptyLine, prefixError, prefixWarn } from '../tui'
import chalk from 'chalk'
import ora from 'ora'
import { Config } from '../types'

export default async function (
  client: Based,
  envid: string,
  config: Config,
  fns: BasedFunctionConfig[],
  unchangedFns: number
) {
  if (fns.length > unchangedFns) {
    printEmptyLine()
    const spinner = ora('Deploying function(s)...').start()
    const changedFns = fns.filter((fun) => fun.status !== 'unchanged')
    let i = 0

    const deployFunctions = async () => {
      for (; i < changedFns.length; i++) {
        const fun = changedFns[i]

        spinner.start(
          `Deploying function ${fun.name} (${i + 1}/${changedFns.length})`
        )

        try {
          await client.call('updateFunction', {
            env: envid,
            observable: fun.observable,
            shared: fun.shared,
            name: fun.name,
            code: fun.code,
            sourcemap: fun.sourcemap,
            fromFile:
              fun.bundle === false
                ? false
                : typeof fun.fromFile !== 'undefined'
                ? fun.fromFile
                : true,
          })
        } catch (err) {
          console.info(
            prefixError + chalk.red(`Cannot deploy function ${fun.name}`),
            err.message
          )
        }
      }

      spinner.stop()
    }

    await Promise.race([
      new Promise((resolve) =>
        client.on('connect', async () => {
          await deployFunctions()
          resolve(true)
        })
      ),
      deployFunctions(),
    ])
  } else {
    console.info(prefixWarn + `No functions to deploy`)
  }
}
