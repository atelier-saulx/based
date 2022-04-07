import { hashCompact } from '@saulx/hash'

export const generateServiceDistId = (name: string): string => {
  return 'st' + hashCompact(name)
}

export default generateServiceDistId
