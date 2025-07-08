import { findUp } from 'find-up'
import { bundle } from '@based/bundle'
import { readJSON } from 'fs-extra/esm'

export const getBasedConfig = async () => {
  const basedFile = await findUp(['based.ts', 'based.js', 'based.json'])

  if (basedFile) {
    if (/\.(?:ts|js)$/.test(basedFile)) {
      const bundled = await bundle({
        entryPoints: [basedFile],
      })
      const compiled = bundled.require()
      return compiled.default
    } else {
      return readJSON(basedFile)
    }
  }
}
