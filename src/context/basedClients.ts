import { login } from '../shared/index.js'

export async function contextBasedClient(): Promise<Based.API.Client> {
  let basedClient: Based.API.Client = this.get('basedClient')

  if (basedClient) {
    return basedClient
  }

  const basedProject: Based.Context.Project = await this.get('basedProject')

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
      throw new Error(
        this.i18n(
          'errors.404',
          basedProject?.file ?? this.i18n('appCommand'),
          error,
        ),
      )
    }
  }

  this.set('basedClient', basedClient)

  return basedClient
}
