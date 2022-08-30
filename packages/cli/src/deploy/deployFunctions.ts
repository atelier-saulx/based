import { Based } from '@based/client'
import { BasedFunctionConfig } from './finder'
import { printEmptyLine, prefixSuccess, prefixError, prefixWarn } from '../tui'
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
  // Deploy functions
  const s = Date.now()
  if (fns.length > unchangedFns) {
    printEmptyLine()
    const spinner = ora('Deploying function(s)...').start()

    await fns.reduce(
      (previous, fun, index) =>
        previous.then(async () => {
          spinner.start(
            `Deploying function ${fun.name} (${index + 1}/${
              fns.filter((fun) => fun.status !== 'unchanged').length
            })`
          )
          if (fun.status !== 'unchanged') {
            try {
              await client.call('updateFunction', {
                env: envid,
                observable: fun.observable,
                shared: fun.shared,
                name: fun.name,
                code: fun.code,
                fromFile:
                  fun.bundle === false
                    ? false
                    : typeof fun.fromFile !== 'undefined'
                    ? fun.fromFile
                    : true,
              })
              // await new Promise((resolve) => setTimeout(resolve, 1000))

              // console.info(
              //   prefixSuccess +
              //     `${'Succesfully deployed function'} ${chalk.blue(
              //       fun.name
              //     )} ${'to'} ${chalk.blue(
              //       `${config.project}/${config.env}`
              //     )} ${chalk.grey('in ' + (Date.now() - s) + 'ms')}`
              // )
            } catch (err) {
              spinner.stop()
              console.info(
                prefixError + chalk.red('Cannot deploy function'),
                err.message
              )
            }
          }
        }),
      Promise.resolve(null)
    )
    spinner.stop()
    // await Promise.all(
    //   fns.map(async (fun) => {
    //     if (fun.status !== 'unchanged') {
    //       try {
    //         await client.call('updateFunction', {
    //           env: envid,
    //           observable: fun.observable,
    //           shared: fun.shared,
    //           name: fun.name,
    //           code: fun.code,
    //           fromFile:
    //             fun.bundle === false
    //               ? false
    //               : typeof fun.fromFile !== 'undefined'
    //               ? fun.fromFile
    //               : true,
    //         })

    //         spinner.stop()

    //         console.info(
    //           prefixSuccess +
    //             `${'Succesfully deployed function'} ${chalk.blue(
    //               fun.name
    //             )} ${'to'} ${chalk.blue(
    //               `${config.project}/${config.env}`
    //             )} ${chalk.grey('in ' + (Date.now() - s) + 'ms')}`
    //         )
    //       } catch (err) {
    //         spinner.stop()
    //         console.info(
    //           prefixError + chalk.red('Cannot deploy function'),
    //           err.message
    //         )
    //       }
    //     }
    //   })
    // )
  } else {
    console.info(prefixWarn + `No functions to deploy`)
  }
}
