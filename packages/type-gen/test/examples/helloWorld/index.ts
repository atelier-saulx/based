import { BasedFunction } from '@based/functions'

const helloWorld: BasedFunction<
  {
    msg: string
  },
  {
    msg: string
  }
> = async (based, payload) => {
  return { msg: 'hello ' + payload.msg }
}

export default helloWorld
