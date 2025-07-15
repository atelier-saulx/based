import { DbClient } from '@based/db'
import { BasedFunctionConfigs } from '@based/functions'

export const initDynamicFunctions = (server, configDb: DbClient) => {
  configDb.query('function').subscribe(async (data) => {
    const specs: BasedFunctionConfigs = {}
    await Promise.all(
      data.map(async (item) => {
        const { contents, name, config } = item
        const fn = await import(`data:text/javascript,${contents}`)
        specs[name] = {
          type: 'function',
          fn: fn.default,
          ...fn,
          ...config,
        }
      }),
    )
    server.functions.add(specs)
  })
}
