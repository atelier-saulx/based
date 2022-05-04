import based from '@based/client'
import { Command, program } from 'commander'
import checkAuth from '../checkAuth'
import { command as addGlobalOptions, GlobalOptions } from '../command'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'
import {
  fail,
  printAction,
  printEmptyLine,
  printError,
  printHeader,
  prefixNotice,
} from '../tui'
import { GenericOutput } from '../types'
import { renderLogs } from './renderLogs'
import { findInstances, Instance } from './findInstances'
import { LogData, LogLine, parseLog } from './parseLog'
import readline from 'readline'
import chalk from 'chalk'

export type LogOptions = GlobalOptions & {
  template?: string[]
  name?: string[]
}

type LogOutput = GenericOutput & {
  data: LogData[]
}

const logCommand = new Command('log')
  .description('Log viewer')
  .option('--template <template...>', 'Service template')
  .option('--name <name...>', 'Name the service')
  .action(async (options: LogOptions) => {
    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY) process.stdin.setRawMode(true)

    const config = await makeConfig(options)
    printHeader(options, config)
    options.output === 'fancy' && printAction('Log services')
    console.info(
      prefixNotice +
        chalk.gray('Shortcuts: q - exit, esc - change services/templates')
    )
    printEmptyLine()

    process.stdin.on('keypress', (_, key) => {
      if (key && key.ctrl && key.name === 'c') {
        process.exit(0)
      }
    })

    const token = await checkAuth(options)
    const client = makeClient(config.cluster)
    const statsClient = based({
      org: 'saulx',
      project: 'based-core',
      env: 'shared-services',
      name: '@based/stats-server',
      cluster: config.cluster,
    })
    try {
      if (options.apiKey) {
        const result = await client.auth(token, { isApiKey: true })
        if (!result) fail('Invalid apiKey.', { data: [] }, options)
        await statsClient.auth(token, { isApiKey: true })
      } else {
        await client.auth(token)
        await statsClient.auth(token)
      }
    } catch (error) {
      fail(error, { data: [] }, options)
    }

    const output: LogOutput = { data: [] }

    if (
      options.output === 'none' ||
      (options.nonInteractive && (!options.name || !options.template))
    ) {
      fail(
        'template or name and force arguments must be suplied in non interactive mode.',
        output,
        options
      )
    }

    try {
      let wantedNames: string[]
      let wantedTemplates: string[]
      if (options.name || options.template) {
        wantedNames = options.name
        wantedTemplates = options.template
      }

      let instances: Instance[]
      ;({ instances, wantedNames, wantedTemplates } = await findInstances(
        client,
        config,
        options,
        wantedNames,
        wantedTemplates
      ))
      process.stdin.setRawMode(true)
      process.stdin.resume()

      let stopObserving: () => void
      let columns = process.stdout.columns
      let logLines: LogLine[] = []
      let lastLogShownTime: number

      const showInstanceMenu = async () => {
        disableEvents()
        stopObserving()
        ;({ instances, wantedNames, wantedTemplates } = await findInstances(
          client,
          config,
          options,
          wantedNames,
          wantedTemplates,
          true
        ))
        lastLogShownTime = null
        startObserving()
        enableEvents()
      }

      const keypressHandler = (_: any, key: any) => {
        if (!key) return
        if (key.name === 'q') {
          process.exit(0)
        } else if (key.name === 'escape') {
          showInstanceMenu()
        }
      }

      process.on('SIGINT', function () {
        process.exit(0)
      })

      const enableEvents = () => {
        process.stdout.on('resize', () => {
          columns = process.stdout.columns
        })
        process.stdin.on('keypress', keypressHandler)
      }
      const disableEvents = () => {
        process.stdin.off('keypress', keypressHandler)
      }

      const startObserving = async () => {
        const instanceIds: string[] = instances.map((instance) => instance.id)
        stopObserving = await statsClient.observe(
          'logs',
          { ids: instanceIds },
          (response) => {
            try {
              const lastLogShownIndex = response.logs.findIndex(
                (log: LogData) => log.time === lastLogShownTime
              )
              output.data = response.logs

              if (options.output === 'fancy') {
                const startTime = process.hrtime.bigint()
                logLines = parseLog(
                  output.data.slice(
                    lastLogShownIndex === -1 ? 0 : lastLogShownIndex + 1
                  ),
                  instances,
                  columns
                )
                lastLogShownTime = response.logs[response.logs.length - 1]?.time
                if (options.debug) {
                  logLines.push({
                    text: `parse time: ${
                      (process.hrtime.bigint() - startTime) / 1000n
                    }ms`,
                    time: 0,
                    color: 'debug',
                  })
                }
                renderLogs(logLines)
              } else {
                fail('Only output fancy is implemented now.', output, options)
              }
            } catch (error) {
              console.error(error)
              process.exit(1)
            }
          }
        )
      }

      enableEvents()
      await startObserving()
    } catch (error) {
      options.debug && printError(error)
      fail('Error logging services', output, options)
    }
  })

program.addCommand(addGlobalOptions(logCommand))
