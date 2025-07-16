import { DbClient } from '@based/db'
import { BasedFunctionConfigs } from '@based/functions'
import { BasedServer } from '@based/server'

export const initDynamicFunctions = (
  server: BasedServer,
  configDb: DbClient,
) => {
  configDb.query('function').subscribe(async (data) => {
    const specs: BasedFunctionConfigs = {}
    await Promise.all(
      data.map(async (item) => {
        const { code, name, config } = item
        try {
          const fn = await import(
            `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
          )
          const { default: fnDefault, js, css, ...rest } = fn
          if (config.type === 'authorize') {
            console.warn('skipping authorize', name, config)
            return
          }

          if (config.type === 'app') {
            specs[name] = {
              fn: (based, _payload, ctx) => {
                return fnDefault(
                  based,
                  {
                    css: {
                      url: config.css,
                    },
                    js: {
                      url: config.js,
                    },
                    favicon: {
                      get url() {
                        console.log('TODO FAVICON')
                        return ''
                      },
                    },
                  },
                  ctx,
                )
              },
              ...rest,
              ...config,
              type: 'function',
            }
          } else {
            specs[name] = {
              type: 'function',
              fn: fnDefault,
              ...rest,
              ...config,
            }
          }
        } catch (err) {
          console.log('err', name, err.message)
        }
      }),
    )
    server.functions.add(specs)
  })
}
