import { BasedFunction } from '@based/functions'

const helloWorld: BasedFunction<
  {
    msg: string
    gurt: number
  },
  {
    bla: number
    msg: string
  }
> = async (based, payload) => {
  return { msg: 'hello ' + payload.msg, bla: 0 }
}

export default helloWorld

/*
 import type HelloWorld from '../../type-gen/test/examples/helloWorld/index.ts'
  call(
    name: 'hello-world',
    payload: Parameters<typeof HelloWorld>[1],
    opts?: CallOptions
  ): ReturnType<typeof HelloWorld>
*/
