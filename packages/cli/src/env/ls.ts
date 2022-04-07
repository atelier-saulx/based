import ora from 'ora'
import chalk from 'chalk'
import {
  padded,
  prefix,
  prefixDanger,
  prefixError,
  prefixNotice,
  printAction,
  printEmptyLine,
  printError,
} from '../tui'
import { GenericOutput } from '../types'

type OrgData = {
  instances: {
    total: number
    errored?: string[]
    deploying?: string[]
  }
  project: string
  env: string
}

type EnvsLsOutput = GenericOutput & {
  data: {
    org: string
    items?: OrgData[]
  }[]
}

export const ls = async ({ client, options }) => {
  options.output === 'fancy' && printAction('List environments')

  const output: EnvsLsOutput = { data: [] }

  const spinner = ora('Getting envs').start()
  try {
    const list = await client.call('listEnvs')
    spinner.clear()

    const obj = {}
    for (const env of list) {
      if (!obj[env.org]) {
        obj[env.org] = {}
      }
      if (!obj[env.org][env.project]) {
        obj[env.org][env.project] = []
      }
      obj[env.org][env.project].push(env)
    }
    for (const org in obj) {
      const orgData = {
        org,
        items: [],
      }
      for (const project in obj[org]) {
        for (const env of obj[org][project]) {
          // env.serviceInstances[0].status = 7
          const envData: OrgData = {
            project,
            env: env.env,
            instances: {
              total: env.serviceInstances.length,
            },
          }
          const sICorrect = env.serviceInstances.filter(
            (s: any) => s.status === 1
          )
          if (sICorrect.length !== env.serviceInstances.length) {
            if (
              env.serviceInstances.find((s: any) => {
                return s.status !== 7 && s.status !== 1 && s.status
              })
            ) {
              envData.instances.errored = env.serviceInstances
                .filter(
                  (instance: any) =>
                    instance.status !== 7 &&
                    instance.status !== 1 &&
                    instance.status
                )
                .map(
                  (instance: any) =>
                    instance.name + ' ' + instance.machine.publicIp
                )
            } else {
              envData.instances.deploying = env.serviceInstances
                .filter((instance: any) => instance.status === 7)
                .map(
                  (instance: any) =>
                    instance.name + ' ' + instance.machine.publicIp
                )
            }
          }
          orgData.items.push(envData)
        }
      }
      output.data.push(orgData)
    }
  } catch (err) {
    spinner.clear()
    output.errors = output.errors || []
    output.errors.push({ message: 'Cannot get environments' })
    options.debug && printError(err)
  }
  if (options.output === 'json') {
    console.info(JSON.stringify(output, null, 2))
  } else if (options.output === 'fancy') {
    printOutput(output)
  }
}

const instancesString = (instances: any) => {
  if (instances.errored?.length) {
    return chalk.red(
      instances.total - instances.errored.length + '/' + instances.total
    )
  } else if (instances.deploying?.length) {
    return chalk.blue(
      instances.total - instances.deploying.length + '/' + instances.total
    )
  } else {
    return chalk.green(instances.total)
  }
}
const printOutput = (output: EnvsLsOutput) => {
  output.data.forEach((orgData) => {
    const colSpacing = 2
    const instancesHeader = 'instances'
    const projectHeader = 'project'
    const envHeader = 'env'
    const instancesColLength = instancesHeader.length + colSpacing
    const projectColLength =
      Math.max(
        ...orgData.items
          .map((o) => o.project.length)
          .concat(projectHeader.length)
      ) + colSpacing
    const envColLength =
      Math.max(
        ...orgData.items.map((o) => o.env.length).concat(envHeader.length)
      ) + colSpacing

    console.info(prefix + chalk.blue(orgData.org))
    console.info(
      prefix +
        padded(instancesHeader, instancesColLength, chalk.gray) +
        padded(projectHeader, projectColLength, chalk.gray) +
        padded(envHeader, envColLength, chalk.gray)
    )
    orgData.items.forEach((item: OrgData) => {
      console.info(
        (item.instances?.errored?.length
          ? prefixError
          : item.instances?.deploying?.length
          ? prefixNotice
          : prefix) +
          padded(instancesString(item.instances), instancesColLength) +
          padded(item.project, projectColLength) +
          padded(item.env, envColLength)
      )
      if (item.instances?.errored?.length) {
        item.instances.errored.forEach((erroredInstance) => {
          console.info(
            prefixError +
              ' '.repeat(instancesColLength) +
              chalk.gray(erroredInstance)
          )
        })
      }
    })
  })
  output.data.length > 1 && printEmptyLine()

  if (output.errors?.length) {
    output.errors.forEach((error) => {
      console.info(prefixDanger + chalk.red(error.message))
    })
  }
}
