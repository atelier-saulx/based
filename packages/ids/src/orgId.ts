import { hashCompact } from '@saulx/hash'

export const generateOrgId = (org: string): string => {
  return 'or' + hashCompact(org)
}

export default generateOrgId
