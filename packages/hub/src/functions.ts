import { DbClient } from '@based/db'
import { BasedFunctionConfigs } from '@based/functions'

export const initDynamicFunctions = (server, configDb: DbClient) => {
  configDb.query('function').subscribe(async (data) => {
    const specs: BasedFunctionConfigs = {}
    await Promise.all(
      data.map(async (item) => {
        const { code, name, config } = item
        try {
          const fn = await import(
            `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
          )

          specs[name] = {
            type: 'function',
            fn: fn.default,
            ...fn,
            ...config,
          }
        } catch (err) {
          console.log('err', name, err.message)
        }
      }),
    )
    server.functions.add(specs)
  })
}
