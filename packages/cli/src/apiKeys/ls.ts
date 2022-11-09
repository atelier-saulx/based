/* eslint-disable no-console */
import { Based } from '@based/client'
import { orgId as getOrgId } from '@based/ids'
import chalk from 'chalk'
import ora from 'ora'
import { GlobalOptions } from '../command'
import {
  fail,
  padded,
  prefix,
  prefixNotice,
  printAction,
  printEmptyLine,
  printError,
} from '../tui'
import { Config, GenericOutput } from '../types'

type ApiKeyData = {
  name: string
  id: string
}
type ApiKeysLsOutput = GenericOutput & {
  data: ApiKeyData[]
}

export const ls = async ({
  client,
  options,
  config,
}: {
  client: Based
  options: GlobalOptions
  config: Config
}) => {
  options.output === 'fancy' && printAction('List apiKeys')

  const output: ApiKeysLsOutput = { data: [] }

  let spinner: ora.Ora
  try {
    if (options.output === 'fancy') {
      spinner = ora('Getting apiKeys').start()
    }
    const orgId = getOrgId(config.org)
    const { apiKeys } = await client.get('listApiKeys', {
      orgId,
    })
    spinner && spinner.stop()

    if (!apiKeys?.length && options.output === 'fancy') {
      console.info(prefixNotice + 'No apiKeys found')
    } else {
      apiKeys?.forEach((apiKey: { id: string; name: string }) => {
        const { /*id,*/ name } = apiKey
        output.data.push({
          // id,
          name,
        })
      })
    }
  } catch (error) {
    spinner && spinner.stop()
    options.debug && printError(error)
    fail('Cannot get apiKeys', output, options)
  }

  if (options.output === 'json') {
    console.info(JSON.stringify(output, null, 2))
  } else if (options.output === 'fancy') {
    printOutput(output)
  }
}

const printOutput = (output: ApiKeysLsOutput) => {
  if (!output.data.length) return

  const colSpacing = 2
  // const idHeader = 'id'
  const nameHeader = 'name'
  // const idColLength =
  //   Math.max(
  //     ...output.data
  //       .map((item: ApiKeyData) => item.id.length)
  //       .concat(idHeader.length)
  //   ) + colSpacing
  const nameColLength =
    Math.max(
      ...output.data
        .map((item: ApiKeyData) => item.name.length)
        .concat(nameHeader.length)
    ) + colSpacing

  console.info(
    prefix +
      // padded(idHeader, idColLength, chalk.gray) +
      padded(nameHeader, nameColLength, chalk.gray)
  )
  output.data.forEach((item: ApiKeyData) => {
    console.info(
      prefix +
        // padded(item.id, idColLength, chalk.blue) +
        padded(item.name, nameColLength)
    )
  })
  output.data.length > 1 && printEmptyLine()
}
