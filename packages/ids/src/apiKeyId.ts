import { hashCompact } from '@saulx/hash'

export const generateApiKeyId = (org: string, name: string): string => {
  return 'ak' + hashCompact({ org, name })
}

export default generateApiKeyId
