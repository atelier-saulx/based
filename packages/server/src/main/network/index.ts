import { BasedServer, ServerOptions } from '../server'

export const attachNetwork = (server: BasedServer, opts: ServerOptions) => {
  console.info('go', server, opts)
}
