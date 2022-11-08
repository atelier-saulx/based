import { BasedServer, CallFunction, ObservableFunction } from '.'

// ....

// TODO: does the same as getDefaultFunction?
export const getFunction = async (
  server: BasedServer,
  name: string
): Promise<ObservableFunction | CallFunction | null> => {
  let fn = server.config?.functions?.[name]

  if (!fn && server.config?.functionConfig) {
    fn = await server.config.functionConfig.getInitial(server, name)

    if (fn) {
      if (!server.config.functions) {
        server.config.functions = {}
      }
      server.config.functions[name] = fn
      fn.cnt = 0
    }
  }

  if (fn && fn.cnt !== undefined) {
    fn.cnt = 0
  }
  return fn || null
}

export const getAuthorize = async (server: BasedServer): Promise<any> => {
  let fn = server.config?.authorize

  // if from the env 'defaultAuth' call defaultAuth function as well or something?

  // console.info('GET AUTHORIZE CONFIG')

  if (!fn && server.config?.functionConfig) {
    const r = await server.config.functionConfig.getInitial(server, 'authorize')

    // console.info('GET AUTH-->', r)

    if (r) {
      if (!server.config.functions) {
        server.config.functions = {}
      }
      // @ts-ignore
      server.config.functions.authorize = fn

      if (r.observable === false) {
        server.config.authorize = r.function
        fn = r.function
        server.config.noAuth = false
      }
    } else if (!server.config?.defaultAuthorize) {
      server.config.noAuth = true
    }
  }

  return fn || null
}
