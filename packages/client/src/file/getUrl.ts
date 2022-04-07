import { Based } from '..'
import {
  FileUploadOptions,
  FileUploadStream,
  FileUploadPath,
} from '@based/types'
import getService from '@based/get-service'

const memoize = {}
const inProgress = {}

const getUrl = async (
  client: Based,
  options: FileUploadOptions | FileUploadStream | FileUploadPath
): Promise<string> => {
  if (options.url) {
    return typeof options.url === 'string' ? options.url : await options.url()
  }

  if (!client.opts.env && client.opts.url) {
    return typeof client.opts.url === 'string'
      ? client.opts.url
      : await client.opts.url()
  }

  const { env, project, org } = client.opts

  const id = env + '/' + project + '/' + org + '/' + client.opts.cluster

  if (memoize[id]) {
    return memoize[id]
  }

  if (inProgress[id]) {
    const r = await inProgress[id]
    return r.url
  }

  const r = await (inProgress[id] = getService(
    {
      env,
      project,
      org,
      name: '@based/hub',
      key: 'file-upload', // make this clear that its nessecary
      optionalKey: true,
    },
    0,
    client.opts.cluster
  ))

  delete inProgress[id]

  setTimeout(() => {
    delete memoize[id]
  }, 2e3)

  return (memoize[id] = r.url)
}

export default getUrl
