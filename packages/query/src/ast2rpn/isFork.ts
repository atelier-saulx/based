import { Fork } from './types.js'

export default function isFork(x: any): x is Fork {
  return x && typeof x === 'object' && x.isFork
}
