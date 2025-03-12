import type { OutputFile } from '@based/bundle'
import type { BasedClient } from '@based/client'
import { hash } from '@saulx/hash'
import { queued } from '@saulx/utils'
import type { AppContext } from '../../context/index.js'

export const queuedFileUpload = queued(
  async (client: BasedClient, payload: any, destUrl: string) => {
    const { status } = await fetch(destUrl, { method: 'HEAD' })

    if (status === 200) {
      return { src: destUrl }
    }

    return client.stream('db:file-upload', payload)
  },
  { dedup: (_client, payload) => hash(payload), concurrency: 10 },
)

export const queuedFnDeploy = queued(
  async (
    context: AppContext,
    client: BasedClient,
    checksum: number,
    config: Based.Deploy.FunctionBase,
    js: OutputFile,
    sourcemap: OutputFile,
  ) => {
    const { error, distId } = await client.stream('based:set-function', {
      contents: js.contents,
      payload: {
        checksum,
        config,
      },
    })

    if (error) {
      throw new Error(error)
    }

    if (distId) {
      await client
        .stream('based:set-sourcemap', {
          contents: sourcemap.contents,
          payload: {
            distId,
            checksum,
          },
        })
        .catch((error) => {
          context.print.error(
            `Could not save sourcemap for: ${config.name} ${error.message}`,
          )
        })
    } else {
      context.print.error('No dist id returned from set-function')
    }

    return { distId }
  },
  { dedup: (_context, _client, checksum) => hash(checksum), concurrency: 10 },
)
