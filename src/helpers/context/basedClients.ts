import { login } from '../../shared/index.js'

export async function contextBasedClient(): Promise<Based.API.Client> {
  let basedClient: Based.API.Client = this.get('basedClient')
  const { file } = await this.get('basedProject')

  if (basedClient) {
    return basedClient
  }

  if (!basedClient || !Object.keys(basedClient).length) {
    try {
      basedClient = await login({})
    } catch (error) {
      throw new Error(this.i18n('errors.404', file, error))
    }
  }

  this.set('basedClient', basedClient)

  return basedClient
}
