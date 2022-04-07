import { Based } from '@based/client'
import { prettyDate } from '@based/pretty-date'
import { prettyNumber } from '@based/pretty-number'
import chalk from 'chalk'
import { fail, prefix } from '../tui'
import { BackupOptions } from '.'
import { Config, GenericOutput } from '../types'

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

export async function listBackups(
  client: Based,
  options: BackupOptions,
  config: Config
) {
  const output: BackupListOutput = { data: [] }

  Object.assign(options, config)
  const res: BackupInfo[] = await client.call('listBackups', options)
  if (!res) {
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
      const date = prettyDate(Date.parse(el.LastModified), 'date-time-human')
      const size = prettyNumber(el.Size, 'number-bytes')
      if (size.length > maxSize) maxSize = size.length
      if (date.length > maxDate) maxDate = date.length
      list.push([size, date, el.Key])
    }

    let whitespace1: number = maxSize - 'Size'.length
    let whitespace2: number = maxDate - 'Date'.length
    console.info(
      prefix +
        chalk.blueBright(
          'Date',
          Array(whitespace2).fill(' ').join(''),
          'Size',
          Array(whitespace1).fill(' ').join(''),
          'Key'
        )
    )
    list.forEach((value) => {
      const [size, date, key] = value
      whitespace1 = maxSize - size.length
      whitespace2 = maxDate - date.length
      console.info(
        prefix + chalk.green(`${date}`),
        Array(whitespace2).fill(' ').join(''),
        chalk.magenta(`${size}`),
        Array(whitespace1).fill(' ').join(''),
        chalk.yellow(`${key}`)
      )
    })
  } else if (options.output === 'json') {
    output.data = res
    console.info(JSON.stringify(output, null, 2))
  }

  process.exit()
}
