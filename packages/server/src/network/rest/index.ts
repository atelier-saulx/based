import uws from '@based/uws'
import { BasedServer } from '../../server'
import { RestClient } from '../../types'

export const rest = (
  server: BasedServer,
  req: uws.HttpRequest,
  res: uws.HttpResponse
) => {
  console.info('RRRRRRESSSSSTTTTT')

  // no make a type 'context'

  // if no handler for path will try to read / get from functions/obs (not by name but by path)

  const client: RestClient = {
    req,
    res,
  }
}
