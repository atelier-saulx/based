import findUp from 'find-up'
import { resolve } from 'path'

export default async (basedFile?: false | string) => {
  // OR BASED FIELD IN PKG.json

  if (basedFile === false) {
    return
  }

  if (typeof basedFile === 'string') {
    const path = resolve(basedFile)
    try {
      const x = require(path)
      return x
    } catch (err) {
      console.error(`invalid based config path ${path}`)
      return
    }
  }

  const x = await findUp(['based.js', 'based.json'])
  if (x) {
    try {
      // console.info(x)
      const parsedConfig = require(x)
      if (typeof parsedConfig !== 'object') {
        console.error(`Invalid based config ${x}`)
      }
      return parsedConfig
    } catch (err) {
      console.error(`Invalid based config ${x}`)
    }
  }
}
