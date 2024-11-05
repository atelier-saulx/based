import { Command } from 'commander'
// import { AppContext, saveAsTypeScriptFile } from '../../../shared/index.js'
import { AppContext } from '../../../shared/index.js'

export const init =
  (program: Command) =>
  // async ({ name, description, domains, machine, min, max, path }) => {
  async ({ path }) => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    const { destroy } = await context.getBasedClient()
    const { skip } = context.getGlobalOptions()

    if (!skip) {
    }

    try {
      await makeInfra({ context, path })

      destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const makeInfra = async (
  {
    // context,
    // path,
  }: {
    context: AppContext
    path: string
  },
) => {
  const infraTemplate = {
    env: {
      description: '',
      domains: [''],
      machine: 't3.small',
      max: 1,
      min: 1,
      services: {
        '@based/env-hub-discovery': {
          distChecksum: '',
          instances: {
            '0': {
              port: 80,
            },
          },
        },
        '@based/env-registry': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4000,
            },
          },
        },
        '@based/env-config-db': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4001,
            },
          },
        },
        '@based/env-db': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4002,
            },
          },
        },
        '@based/env-db-registry': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4003,
            },
          },
        },
        '@based/env-db-sub-manager': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4004,
            },
          },
        },
        '@based/env-events-hub': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4005,
            },
          },
        },
        '@based/env-jobs': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4006,
            },
          },
        },
        '@based/env-metrics-db': {
          distChecksum: '',
          instances: {
            '0': {
              port: 4007,
            },
          },
        },
      },
    },
  }

  console.log('infraTemplate', infraTemplate)

  try {
    // await saveAsTypeScriptFile(infraTemplate, path)
  } catch (error) {
    throw new Error(error)
  }
}
