import { newLogin } from '../../shared/index.js'

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
        basedClient = await newLogin()
      }
    } catch (error) {
      throw new Error(
        this.i18n(
          'errors.404',
          basedProject?.file ?? this.i18n('appCommand'),
          JSON.stringify(error),
        ),
      )
    }
  }

  this.set('basedClient', basedClient)

  return basedClient
}
