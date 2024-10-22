import { login } from '../../shared/index.js'

export async function contextBasedClients(): Promise<Based.Auth.Clients> {
  let basedClients: Based.Auth.Clients = this.get('basedClients')
  const { file } = await this.get('basedProject')

  if (basedClients) {
    return basedClients
  }

  if (!basedClients) {
    basedClients = await login({})

    if (
      !basedClients.basedClient ||
      !basedClients.adminHubBasedCloud ||
      !basedClients.envHubBasedCloud
    ) {
      throw new Error(
        `Fatal error during <b>authorization</b>. Check your '<b>${file}</b>' file or <b>your arguments</b> and try again.`,
      )
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

  return basedClients
}
