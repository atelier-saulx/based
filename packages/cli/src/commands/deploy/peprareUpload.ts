import { hashCompact } from '@saulx/hash'
import mimeTypes from 'mime-types'
import type { AppContext } from '../../context/index.js'
import { queuedFileUpload } from './queues.js'
import type { OutputFile } from 'esbuild'
import type { BundleResult } from '../../bundle/BundleResult.js'

export const prepareFilesToUpload = async (
  files: OutputFile[],
  favicons: Set<string>,
  outputs: BundleResult['result']['metafile']['outputs'],
  publicPath: string,
  assetsMap: Record<string, string>,
): Promise<Based.Deploy.FilesToUpload[]> => {
  const result: Based.Deploy.FilesToUpload[] = []

  for (const { path, contents } of files) {
    if (path in assetsMap) {
      continue
    }

    const fileName = path.substring(path.lastIndexOf('/') + 1)
    const ext = fileName.substring(fileName.lastIndexOf('.'))

    if (ext === '.js') {
      if (favicons.has(outputs[fileName].entryPoint)) {
        continue
      }
    } else if (ext === '.map') {
      if (favicons.has(outputs[fileName.slice(0, -4)].entryPoint)) {
        continue
      }
    }

    const destUrl = `${publicPath}/${fileName}`
    assetsMap[path] = destUrl

    result.push({ path, contents, fileName, ext })
  }

  return Promise.resolve(result)
}

export const uploadFiles =
  (context: AppContext) =>
  async (
    uploads: Based.Deploy.FilesToUpload[],
    publicPath: string,
  ): Promise<void> => {
    if (!uploads || !uploads.length) {
      return
    }

    const basedClient = await context.getBasedClient()

    try {
      let uploading = 0

      context.spinner.start(
        context.i18n('commands.deploy.methods.uploading') +
          context.i18n(
            'commands.deploy.methods.asset',
            uploading.toString(),
            uploads?.length || '0',
          ),
      )

      await Promise.all(
        uploads.map(async ({ contents, ext, fileName }) => {
          const id = `fi${hashCompact(fileName, 8)}`
          const destUrl = `${publicPath}/${fileName}`

          await queuedFileUpload(
            basedClient.get('project'),
            {
              contents,
              fileName,
              mimeType: mimeTypes.lookup(ext),
              payload: { id, $$fileKey: fileName },
            },
            destUrl,
          )

          uploading++

          context.spinner.message =
            context.i18n('commands.deploy.methods.uploading') +
            context.i18n(
              'commands.deploy.methods.asset',
              ++uploading,
              uploads.length || '0',
            )
        }),
      )

      context.spinner.stop(
        context.i18n('commands.deploy.methods.uploaded') +
          context.i18n(
            'commands.deploy.methods.asset',
            uploading,
            uploads.length || '0',
          ),
      )
    } catch (error) {
      throw new Error(error)
    }
  }
