import { Based } from '@based/client'
import { envId as getEnvId } from '@based/ids'
import { Config, ServiceData, ServiceInstanceData } from '../types'
import { LogOptions } from '.'
import inquirer from 'inquirer'
import { inquirerConfig } from '../tui'

export type Instance = {
  name: string
  template: string
  index: number
  id: string
}

export const findInstances = async (
  client: Based,
  config: Config,
  options: LogOptions,
  wantedNames: string[],
  wantedTemplates: string[],
  forceMenu = false
): Promise<{
  instances: Instance[]
  wantedNames: string[]
  wantedTemplates: string[]
}> => {
  const instances = []

  const envId = getEnvId(config.env, config.org, config.project)
  const result = await client.get('listServices', { id: envId })
  let services: ServiceData[] = result?.services || []

  const envs = await client.call('listEnvs')
  const coreServicesEnv = envs.find(
    (env: any) => env.org === 'saulx' && env.env === 'core-services'
  )
  let coreServices = []
  if (coreServicesEnv) {
    ;({ services: coreServices } = await client.get('listServices', {
      id: coreServicesEnv.id,
    }))
  }
  const sharedServicesEnv = envs.find(
    (env: any) => env.org === 'saulx' && env.env === 'shared-services'
  )
  let sharedServices = []
  if (sharedServicesEnv) {
    ;({ services: sharedServices } = await client.get('listServices', {
      id: sharedServicesEnv.id,
    }))
  }
  services = services.concat(coreServices, sharedServices)

  if ((!wantedNames && !wantedTemplates) || forceMenu) {
    ;({ services: wantedTemplates } = await inquirer.prompt({
      ...inquirerConfig,
      type: 'checkbox',
      name: 'services',
      message: 'Select service template:',
      choices: services.map((s) => ({
        name: s.dist?.name + (s.args?.name ? ` (${s.args.name})` : ''),
        value: s.dist.name,
      })),
      default: wantedTemplates,
      loop: false,
    }))
  }

  services.forEach((service) => {
    const wantedNamesIndex = wantedNames?.findIndex(
      (name) => name === service.args?.name
    )
    const wantedTemplatesIndex = wantedTemplates?.findIndex(
      (template) => template === service.dist?.name
    )
    if (wantedNamesIndex > -1 || wantedTemplatesIndex > -1) {
      service.serviceInstances?.forEach(
        (instance: ServiceInstanceData, index) => {
          instances.push({
            name: service.args?.name,
            template: service.dist?.name,
            index,
            id: instance.id,
          })
        }
      )
    }
  })

  // reenable keys adter inquirer
  process.stdin.setRawMode(true)
  process.stdin.resume()

  return { instances, wantedNames, wantedTemplates }
}
