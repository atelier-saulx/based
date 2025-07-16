import type { BasedFunction } from '@based/functions'

const hello: BasedFunction = async (based) => {
  console.info('flapflap')
  return 'FLAP DROOL'
}

export default hello
