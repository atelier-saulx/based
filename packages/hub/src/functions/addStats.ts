import { DbClient } from '@based/db'
import { BasedFunctionConfig } from '@based/functions'

export const addStats = (
  config: BasedFunctionConfig,
  statsDb: DbClient,
): BasedFunctionConfig => {
  if (config.type === 'function') {
    return {
      ...config,
      fn: async (based, _payload, ctx) => {
        console.log(ctx)

        return config.fn(based, _payload, ctx)
      },
    }
  }

  return config
}
