import { ClientContext } from '../types'

export const runFunction = async (
  name: string,
  fn: Function,
  payload: any,
  context: ClientContext
): Promise<any> => {
  return fn(payload, context)
}

// export const observe = async (
//     name: string,
//     fn: Function,
//     payload: any,
//     context: ClientContext
//   ): Promise<any> => {
//     return fn(payload, context)
//   }

// authorize
// observe
