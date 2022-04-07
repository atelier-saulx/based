import { BasedOpts } from '@based/client'

export const genOptsId = (opts: BasedOpts & { key?: string }): string => {
  if (!opts) {
    return
  }
  if (opts.key) {
    return opts.key
  }
  return `${opts.env}_${opts.project}_${opts.org}_${opts.cluster || ''}_${
    opts.name || ''
  }`
}
