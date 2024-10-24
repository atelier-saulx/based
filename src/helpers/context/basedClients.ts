import { login } from '../../shared/index.js'

export async function contextBasedClients(): Promise<Based.Auth.Clients> {
  let basedClients: Based.Auth.Clients = this.get('basedClients')
  const { file } = await this.get('basedProject')

  if (basedClients) {
    return basedClients
  }

  if (!basedClients || !Object.keys(basedClients).length) {
    basedClients = await login({})

    if (
      !basedClients.basedClient ||
      !basedClients.adminHubBasedCloud ||
      !basedClients.envHubBasedCloud
    ) {
      throw new Error(this.i18n('errors.404', file))
    }
  }

  const { basedClient, adminHubBasedCloud, envHubBasedCloud, destroy } =
    basedClients

  basedClients = {
    ...basedClients,
    ...(basedClient && { basedClient }),
    ...(adminHubBasedCloud && { adminHubBasedCloud }),
    ...(envHubBasedCloud && { envHubBasedCloud }),
    ...(destroy && { destroy }),
  }

  this.set('basedClients', basedClients)

  return basedClients
}
