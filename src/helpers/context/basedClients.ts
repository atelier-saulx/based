import { login } from '../../shared/index.js'

export async function contextBasedClients(): Promise<BasedCli.Auth.Clients> {
  const basedProject: BasedCli.Context.Project = this.get('basedProject')
  let basedClients: BasedCli.Auth.Clients = this.get('basedClients')
  if (basedClients) {
    return basedClients
  }

  if (!basedClients) {
    basedClients = await login({
      ...basedProject,
      context: this,
    })

    if (
      !basedClients.basedClient ||
      !basedClients.adminHubBasedCloud ||
      !basedClients.envHubBasedCloud
    ) {
      throw new Error(
        `Fatal error during <b>authorization</b>. Check your <b>'based.json'</b> file or <b>your arguments</b> and try again.`,
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

  this.set('basedClients', basedClients)

  return basedClients
}
