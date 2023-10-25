import { BasedQueryFunction } from '@based/functions'

const counter: BasedQueryFunction<
  {
    msg: string
    gurt: number
  } | void,
  { cnt: number }
> = async (based, payload, update) => {
  let cnt = 0
  const timer = setInterval(() => {
    update({ cnt: ++cnt })
  }, 100)
  return () => {
    clearInterval(timer)
  }
}

export default counter

/*
  import type HelloWorld from '../../type-gen/test/examples/helloWorld/index.ts'
  call(
    name: 'hello-world',
    payload: Parameters<typeof HelloWorld>[1],
    opts?: CallOptions
  ): Parameters<Parameters<typeof HelloWorld>[2]>[0],
*/
