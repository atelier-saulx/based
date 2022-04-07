import { hashCompact } from '@saulx/hash'

export const generateEnvId = (
  env: string,
  org: string,
  project: string
): string => {
  return 'en' + hashCompact(env + org + project)
}

export default generateEnvId
