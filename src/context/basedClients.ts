import { login } from '../shared/index.js'

export async function contextBasedClient(): Promise<Based.API.Client> {
  let basedClient: Based.API.Client = this.get('basedClient')
  const basedProject: Based.Context.Project = await this.get('basedProject')

  if (basedClient) {
    return basedClient
  }

  if (!basedClient || !Object.keys(basedClient).length) {
    try {
      if (
        !basedProject?.apiKey ||
        !basedProject?.org ||
        !basedProject?.project ||
        !basedProject?.env
      ) {
        basedClient = await login()
      }
    } catch (error) {
      const message = Object.keys(error).length ? JSON.stringify(error) : ''

      throw this.i18n(
        'errors.404',
        basedProject?.file ?? this.i18n('appCommand'),
        message,
      )
    }
  }

  this.set('basedClient', basedClient)

  return basedClient
}
