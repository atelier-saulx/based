import { hash } from '@saulx/hash'
import type { AppContext } from '../../context/index.js'

export const schemaDeploy = async (
  context: AppContext,
  schema: Based.Deploy.Configs,
  configsMap: Record<string, number>,
) => {
  if (schema) {
    const basedClient = await context.getBasedClient()
    let checksum: number

    checksum = hash(schema)

    if (configsMap[schema.path] !== checksum) {
      context.spinner.start(
        context.i18n('commands.deploy.methods.deploying') +
          context.i18n('commands.deploy.methods.schema', 1, 1),
      )

      await basedClient.get('project').call('db:set-schema', schema)

      context.print.success(
        context.i18n('commands.deploy.methods.deployed') +
          context.i18n('commands.deploy.methods.schema', 1, 1),
      )

      configsMap[schema.path] = checksum
    }
  }
}
