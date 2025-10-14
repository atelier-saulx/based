import type { BasedFunction } from '@based/functions'

const update: BasedFunction = async (based, args: [string, number, any]) => {
  console.log(args)
  return based.db.update(...args)
}

export default update
