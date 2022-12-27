import fs from 'fs-extra'
import https from 'https'
import ora from 'ora'
import { BackupOptions } from '.'
import { prettyDate } from '@based/pretty-date'
import { prettyNumber } from '@based/pretty-number'
import inquirer from 'inquirer'
import {
  fail,
  inquirerConfig,
  prefixSuccess,
  prefixWarn,
  printHeader,
} from '../tui'
import chalk from 'chalk'
import { Command } from 'commander'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'

export const backupDownloadCommand = new Command('download')
  .description('Download remote backup file')
  .option(
    '-db --database <name>',
    "Name of the database, defaults to 'default'"
  )
  .option('-f --filename <name>', 'Name of the remote file to download')
  .action(async (options: BackupOptions) => {
    const config = await makeConfig(options)
    printHeader(options, config)

    const token = await checkAuth(options)
    const client = makeClient(config.cluster)

    try {
      if (options.apiKey) {
        const result = await client.auth(token, { isApiKey: true })
        if (!result) fail('Invalid apiKey.', { data: [] }, options)
      } else {
        await client.auth(token)
      }
    } catch (error) {
      fail(error, { data: [] }, options)
    }
    Object.assign(options, config)
    const { org, project, env, database } = options

    const folderName = database
      ? `${org}-${project}-${env}-db-env-${database}`
      : `${org}-${project}-${env}-db-env-default`

    console.info(
      prefixWarn +
        chalk.gray('Database: ') +
        chalk.bold(`${database || 'default'} `)
    )

    let filename = 'dump.rdb'

    if (options.nonInteractive) {
      try {
        if (!options.filename) {
          fail(
            'Please specify backup name, syntax: --backup-name <name>',
            { data: [] },
            options
          )
        }
        filename = options.filename
        const { url } = await client.call('getBackupLink', options)
        await downloadUrl(url, folderName, filename)
      } catch (err) {
        fail(err.message, { data: [], errors: [err] }, options)
      }
    } else {
      if (options.filename) {
        filename = options.filename
        const { url } = await client.call('getBackupLink', options)
        await downloadUrl(url, folderName, filename)
        process.exit(0)
      }
      const res = await client.call('listBackups', options)
      if (!res) fail('No backup found', { data: [] }, options)

      // sort results based on lastModified, most recent first
      res.sort((a, b) => {
        return b.LastModified - a.LastModified
      })

      const mapOfChoices = getMapOfChoices(res)

      const answers = await inquirer.prompt({
        ...inquirerConfig,
        type: 'list',
        name: 'downloadName',
        loop: true,
        message: 'Which backup would you like to download?',
        choices: [...mapOfChoices.keys()],
      })
      const { downloadName } = answers

      Object.assign(options, {
        filename: mapOfChoices.get(downloadName).Key,
      })
      try {
        filename = options.filename
        const { url } = await client.call('getBackupLink', options)
        await downloadUrl(url, folderName, filename)
      } catch (err) {
        fail(err.message, { data: [] }, options)
      }
    }

    process.exit(0)
  })

function downloadUrl(url: string, path: string, filename: string) {
  return new Promise<void>((resolve, reject) => {
    const spinner = ora('Downloading backup...').start()
    const fullPath = `${path}/${filename}`

    let size
    let cur = 0

    fs.ensureDirSync(path)
    if (fs.existsSync(fullPath)) {
      spinner.clear()
      reject(new Error('File already exists'))
      return
    }
    const stream = fs.createWriteStream(fullPath)
    https.get(url, (resp) => {
      if (resp.statusCode === 200) {
        resp.pipe(stream)
        size = parseInt(resp.headers['content-length'])
        resp.on('data', (chunk) => {
          cur += chunk.length
          spinner.text = `Downloading backup... ${((cur / size) * 100).toFixed(
            1
          )}%`
        })
      } else {
        spinner.clear()
        fs.unlink(fullPath)
        reject(new Error(`Request got ${resp.statusCode} response code`))
      }
    })
    stream
      .on('finish', () => {
        stream.close()
        spinner.clear()
        console.info(
          prefixSuccess + `File downloaded to ` + chalk.blue(`./${fullPath}`)
        )
        resolve()
      })
      .on('error', (err) => {
        spinner.clear()
        fs.unlink(fullPath)
        reject(new Error(`error while writing file: ${err}`))
      })
  })
}

function getMapOfChoices(list): Map<string, any> {
  const mapOfChoices = new Map()
  for (const [index, value] of list.entries()) {
    const date = prettyDate(value.LastModified, 'date-time-human')
    const size = prettyNumber(value.Size, 'number-bytes')
    const name: string = value.Key
    // Deprecated: not really relevant since this migration system was never implemented
    // {
    //    2021-10-27T09:50:17.545Z-copy-from-local-saulx-chat-dev-db-env-default
    //    2021-10-27T09:50:17.545Z-copy
    //    2021-10-27T09:50:17.545Z-copy-1
    //    becomes
    //    #85, from 2 days ago, 2.8 kb, migrated from saulx-chat-prod(users)
    //    #84, from 2 days ago, 2.8 kb, migrated from saulx-chat-prod(default)
    //    #83, from 2 days ago, 2.8 kb
    //    #82, from 2 days ago, 2.8 kb, copy of #66.
    // }
    mapOfChoices.set(
      `#${list.length - index}, "${name}" from ${date}, ${size}`,
      value
    )
  }
  return mapOfChoices
}
