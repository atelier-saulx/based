import type { BasedFunction } from '@based/functions'

const del: BasedFunction = async (based, args: [string, number]) => {
  console.log(args)
  return based.db.delete(...args)
}

export default del
