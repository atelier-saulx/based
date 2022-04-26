import getToken from './getToken'
import { innerAuth } from './auth'
import inquirer from 'inquirer'
import { inquirerConfig, prefix, prefixError, printEmptyLine } from './tui'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { makeConfig } from './makeConfig'
import { GlobalOptions } from './command'

const decodeToken = (token: string) => {
  if (!token) return
  try {
    const parts = token.split('.')
    const body = Buffer.from(parts[1], 'base64')
    return JSON.parse(body.toString('ascii'))
  } catch (error) {}
}

export default async (
  options: GlobalOptions,
  forceReAuth: boolean = false
): Promise<string | null> => {
  if (options.apiKey) {
    let apiKey: string
    if (typeof options.apiKey === 'boolean') {
      if (!process.env.BASED_APIKEY) {
        printEmptyLine()
        console.info(
          prefixError +
            `Use --api-key with the apiKey file as a value or set the environment variable BASED_APIKEY with the key.`
        )
        process.exit(1)
      }
      apiKey = process.env.BASED_APIKEY
    } else {
      const filePath = path.join(process.cwd(), options.apiKey)
      try {
        apiKey = await new Promise((resolve, reject) => {
          fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
              reject(err)
            }
            resolve(data)
          })
        })
      } catch (error) {
        printEmptyLine()
        console.info(
          prefixError + `Cannot find apiKey file ${chalk.blue(filePath)}`
        )
        process.exit(1)
      }
    }

    return apiKey
  } else {
    const config = await makeConfig(options)
    const { token } = await getToken(config.cluster)

    // TODO: Check this on the based client and handle the error
    const isExpired =
      decodeToken(token)?.iat * 1e3 < Date.now() - 1e3 * 60 * 60 * 24 * 5

    if (!token || forceReAuth || isExpired) {
      printEmptyLine()
      console.info(prefix + 'No credentials found, please log in')
      const x = await inquirer.prompt([
        {
          ...inquirerConfig,
          type: 'input',
          name: 'email',
          message: 'Enter your email address:',
        },
      ])
      if (x.email) {
        const token = await innerAuth(x.email, options)
        if (token) {
          return token
        } else {
          // console.error(chalk.red('Cannot login'))
          process.exit()
        }
      } else {
        process.exit()
      }
    } else {
      return token
    }
  }
}
