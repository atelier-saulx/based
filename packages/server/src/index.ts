import { BasedServer, ServerOptions } from './main/server'

export { BasedServer }

const createServer = async (
  props: ServerOptions,
  sharedSocket?: boolean
): Promise<BasedServer> => {
  const basedServer = new BasedServer(props)
  return props.port ? basedServer.start(props.port, sharedSocket) : basedServer
}

export default createServer

// lets check which types we want to export... more specific
export * from './types'

// maybe send responsed
export { compress } from './compress'
// export { sendHttpResponse } from './main/sendHttpResponse'
// export { sendError } from './main/sendError'

// same here...
export * from './error'
