import fs from 'fs-extra'
import https from 'https'
import ora from 'ora'
import { BackupOptions } from '.'
import { Based } from '@based/client'
import { prettyDate } from '@based/pretty-date'
import { prettyNumber } from '@based/pretty-number'
import inquirer from 'inquirer'
import { fail, inquirerConfig, prefixSuccess } from '../tui'
import { Config } from '../types'
import chalk from 'chalk'

export async function downloadBackup(
  client: Based,
  options: BackupOptions,
  config: Config
) {
  Object.assign(options, config)
  const { cluster, org, project, env, database, backupName } = options

  let bucketName = `${cluster}-${org}-${project}-${env}-db-env-${
    database || 'default'
  }/${backupName}`
  const filename = 'dump.rdb'

  if (options.nonInteractive) {
    try {
      if (!options.backupName)
        fail(
          'Please specify backup name, syntax: --backup-name <name>',
          { data: [] },
          options
        )
      const { url } = await client.call('getBackupLink', options)
      await downloadUrl(url, bucketName, filename)
    } catch (err) {
      fail(err.message, { data: [], errors: [err] }, options)
    }
  } else {
    if (options.backupName)
      fail(
        'Option --backup-name can only be used in non-interactive mode',
        { data: [] },
        options
      )
    const res = await client.call('listBackups', options)
    if (!res) fail('No backup found', { data: [] }, options)

    // sort results based on lastModified, most recent first
    res.sort((a, b) => {
      return Date.parse(b.LastModified) - Date.parse(a.LastModified)
    })

    const mapOfChoices = getMapOfChoices(res)

    const answers = await inquirer.prompt({
      ...inquirerConfig,
      type: 'list',
      name: 'downloadName',
      loop: false,
      message: 'Which backup would you like to download?',
      choices: [...mapOfChoices.keys()],
    })
    const { downloadName } = answers

    bucketName = `${cluster}-${org}-${project}-${env}-db-env-${
      database || 'default'
    }/${mapOfChoices.get(downloadName).Key}`
    Object.assign(options, {
      backupName: mapOfChoices.get(downloadName).Key,
    })
    try {
      const { url } = await client.call('getBackupLink', options)
      await downloadUrl(url, bucketName, filename)
    } catch (err) {
      fail(err.message, { data: [] }, options)
    }
  }
}

async function downloadUrl(url: string, path: string, filename: string) {
  return new Promise<void>((resolve, reject) => {
    const spinner = ora('Downloading backup...').start()
    const fullPath = `${path}/${filename}`
    fs.ensureDirSync(path)
    const exists = fs.existsSync(fullPath)
    if (exists) {
      spinner.clear()
      reject(new Error('File already exists'))
      return
    }
    const stream = fs.createWriteStream(fullPath)
    https.get(url, (resp) => {
      if (resp.statusCode === 200) {
        resp.pipe(stream)
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
    const date = prettyDate(Date.parse(value.LastModified), 'date-time-human')
    const size = prettyNumber(value.Size, 'number-bytes')
    const name: string = value.Key

    // 2021-10-27T09:50:17.545Z-copy-from-local-saulx-chat-dev-db-env-default
    // 2021-10-27T09:50:17.545Z-copy
    // 2021-10-27T09:50:17.545Z-copy-1
    // becomes
    // #85, from 2 days ago, 2.8 kb, migrated from saulx-chat-prod(users)
    // #84, from 2 days ago, 2.8 kb, migrated from saulx-chat-prod(default)
    // #83, from 2 days ago, 2.8 kb
    // #82, from 2 days ago, 2.8 kb, copy of #66.

    if (name.includes('from')) {
      const x = name.search('from') + 'from'.length + 1
      const y = name.search('db-env') + 'db-env'.length + 1

      mapOfChoices.set(
        `#${
          list.length - index
        }, from ${date}, ${size}, migrated from ${name.substring(
          x,
          y - '-db-env-'.length
        )}(${name.substring(y)})`,
        value
      )
    } else if (name.includes('copy')) {
      const x = name.search('copy')
      let copiedElementIndex
      list.some((el) => {
        if (el.Key === name.substring(0, x - 1)) {
          copiedElementIndex = list.indexOf(el)
          return true
        }
        return false
      })
      mapOfChoices.set(
        `#${list.length - index}, from ${date}, ${size}, copy of #${
          list.length - copiedElementIndex
        }`,
        value
      )
    } else {
      mapOfChoices.set(`#${list.length - index}, from ${date}, ${size}`, value)
    }
  }
  return mapOfChoices
}
