import { hashCompact } from '@saulx/hash'

export const generateServiceDistId = (
  name: string,
  version: string
): string => {
  return 'sd' + hashCompact(name + version)
}

export default generateServiceDistId
