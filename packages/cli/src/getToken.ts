import { readJson } from 'fs-extra'
import getBasedLocation from './getBasedLocation'
import { join } from 'path'

export default async (
  cluster: string = 'default'
): Promise<{ email: string | null; token: string | null }> => {
  try {
    const p = getBasedLocation(cluster)
    const x = await readJson(join(p, 'user.json'))
    return x
  } catch (err) {
    return {
      email: null,
      token: null,
    }
  }
}
