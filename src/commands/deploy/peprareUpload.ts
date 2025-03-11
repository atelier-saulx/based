import type { BundleResult, OutputFile } from '@based/bundle'
import { hashCompact } from '@saulx/hash'
import mimeTypes from 'mime-types'
import type { AppContext } from '../../context/index.js'
import { queuedFileUpload } from './queues.js'

export const prepareFilesToUpload = (
  files: OutputFile[],
  favicons: Set<string>,
  outputs: BundleResult['result']['metafile']['outputs'],
  assetsMap: Record<string, string>,
): Based.Deploy.FilesToUpload[] => {
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

    result.push({ path, contents, fileName, ext })
  }

  return result
}

export const uploadFiles =
  (context: AppContext) =>
  async (
    uploads: Based.Deploy.FilesToUpload[],
    publicPath: string,
    assetsMap: Record<string, string>,
  ): Promise<void> => {
    if (!uploads || !uploads.length) {
      return
    }

    const basedClient = await context.getBasedClient()

    try {
      let uploading = 0

      context.spinner.start(
        context.i18n(
          'commands.deploy.methods.uploaded',
          uploading,
          uploads.length,
        ),
      )

      await Promise.all(
        uploads.map(async ({ path, contents, ext, fileName }) => {
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

          context.spinner.message = context.i18n(
            'commands.deploy.methods.uploaded',
            ++uploading,
            uploads.length,
          )

          assetsMap[path] = destUrl
        }),
      )

      context.print.success(
        context.i18n(
          'commands.deploy.methods.uploaded',
          uploading,
          uploads.length,
        ),
      )
    } catch (error) {
      throw new Error(error)
    }
  }
