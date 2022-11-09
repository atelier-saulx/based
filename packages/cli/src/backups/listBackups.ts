import { prettyDate } from '@based/pretty-date'
import { prettyNumber } from '@based/pretty-number'
import chalk from 'chalk'
import { fail, prefix, printHeader } from '../tui'
import { BackupOptions } from '.'
import { GenericOutput } from '../types'
import { Command } from 'commander'
import checkAuth from '../checkAuth'
import makeClient from '../makeClient'
import { makeConfig } from '../makeConfig'

type BackupInfo = {
  Key: string
  LastModified: string
  ETag: string
  Size: number
  StorageClass: string
}

type BackupListOutput = GenericOutput & {
  data: BackupInfo[]
}

export const backupListCommand = new Command('list')
  .description('List remote backup(s) of a specific database')
  .option(
    '-db --database <name>',
    "Name of the database, defaults to 'default'"
  )
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
    const output: BackupListOutput = { data: [] }

    Object.assign(options, config)
    const res: BackupInfo[] = await client.call('listBackups', options)
    if (!res || res.length === 0) {
      fail('No backups found', output, options)
    }

    // sort results based on lastModified, most recent first
    res.sort((a, b) => {
      return Date.parse(b.LastModified) - Date.parse(a.LastModified)
    })

    if (options.output === 'fancy') {
      const list = []
      let maxDate: number = null
      let maxSize: number = null
      for (const el of res) {
        const date = prettyDate(el.LastModified, 'date-time-human')
        const size = prettyNumber(el.Size, 'number-bytes')
        if (size.length > maxSize) maxSize = size.length
        if (date.length > maxDate) maxDate = date.length
        list.push([size, date, el.Key])
      }

      let whitespace1: number = maxDate - 'Date'.length
      let whitespace2: number = maxSize - 'Size'.length

      if (whitespace1 < 0) whitespace1 = 0
      if (whitespace2 < 0) whitespace2 = 0

      console.info(
        prefix +
          chalk.blueBright(
            'Date' + ' '.repeat(whitespace1),
            'Size' + ' '.repeat(whitespace2),
            'Key'
          )
      )
      list.forEach((value) => {
        const [size, date, key] = value
        whitespace2 = maxSize - size.length
        whitespace1 = maxDate - date.length
        if (whitespace2 < 0) whitespace2 = 0
        if (whitespace1 < 0) whitespace1 = 0
        console.info(
          prefix + chalk.green(`${date}`) + ' '.repeat(whitespace1),
          chalk.magenta(`${size}`) + ' '.repeat(whitespace2),
          chalk.yellow(`${key}`)
        )
      })
    } else if (options.output === 'json') {
      output.data = res
      console.info(JSON.stringify(output, null, 2))
    }

    process.exit(0)
  })
