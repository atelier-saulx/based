import { BasedFunction } from '@based/functions'

type Flap<T extends string> = {
  bla: T
}

const helloWorld: BasedFunction<
  {
    msg: string
    gurt: number
  },
  {
    bla: number
    msg: string
    f: Flap<'snurp'>
  }
> = async (based, payload) => {
  return { msg: 'hello ' + payload.msg, bla: 0, f: { bla: 'snurp' } }
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
