import { hash } from '@based/hash'
import type { AppContext } from '../../context/index.js'
import { isDisconnectedError } from '../../shared/errors.js'

export const schemaDeploy = async (
  context: AppContext,
  found: Based.Deploy.Configs,
) => {
  if (!found) {
    return
  }
  const basedClient = await context.getBasedClient()
  let checksum: number

  checksum = hash(found.config)

  if (found.checksum !== checksum) {
    // context.spinner.start(
    //   context.i18n('commands.deploy.methods.deploying') +
    //     context.i18n('commands.deploy.methods.schema', 1, 1),
    // )

    try {
      await basedClient.call(context.endpoints.DEPLOY_SET_SCHEMA, found.config)
    } catch (e) {
      if (!isDisconnectedError(e)) {
        // we currently expect a disconnect because the hub restarts when schema changes
        throw e
      }
    }
    
    context.print.success(
      context.i18n('commands.deploy.methods.deployed') +
        context.i18n('commands.deploy.methods.schema', 1, 1),
    )

    found.checksum = checksum
  }
}
