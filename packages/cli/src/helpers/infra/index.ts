import { AppContext } from '../../context/AppContext.js'

export const exportInfraTemplate = ({
  name,
  description,
  standby,
  domains,
  machine,
  min,
  max,
}: Based.Infra.TemplateInfo): Based.Infra.Template => ({
  autoStandby: standby,
  suspended: false,
  machineConfigs: {
    env: {
      configName: name.trim(),
      description: description.trim(),
      domains,
      machine,
      min,
      max,
      services: {
        '@based/env-hub-discovery': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 80,
            },
          },
        },
        '@based/env-registry': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4000,
            },
          },
        },
        '@based/env-config-db': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4001,
            },
          },
        },
        '@based/env-db': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4002,
            },
          },
        },
        '@based/env-db-registry': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4003,
            },
          },
        },
        '@based/env-db-sub-manager': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4004,
            },
          },
        },
        '@based/env-events-hub': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4005,
            },
          },
        },
        '@based/env-jobs': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4006,
            },
          },
        },
        '@based/env-metrics-db': {
          distChecksum: 'latest',
          instances: {
            '0': {
              port: 4007,
            },
          },
        },
      },
    },
  },
})

export const getMachines = async () => {
  const context: AppContext = AppContext.getInstance()
  const basedClient = await context.getBasedClient()
  const { org, project, env } = context.get('basedProject')

  try {
    const infraData = await basedClient
      .call(context.endpoints.INFRA_GET, {
        org,
        project,
        env,
      })
      .get()

    return infraData?.config?.machineConfigs
  } catch (error) {
    throw new Error(context.i18n('errors.903', error))
  }
}

export const parseOrgsData = (
  data: Based.Infra.UserEnvs[],
): Based.Infra.UserCloudInfo => {
  const result: Based.Infra.UserCloudInfo = {}

  for (const item of data) {
    for (const env of item.envs) {
      if (!result[env.org]) {
        result[env.org] = {}
      }
      if (!result[env.org][env.project]) {
        result[env.org][env.project] = []
      }
      if (!result[env.org][env.project].includes(env.env)) {
        result[env.org][env.project].push(env.env)
      }
    }
  }

  return result
}
