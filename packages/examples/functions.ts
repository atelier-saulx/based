import { BasedFunction } from '@based/sdk'

type Flap<T extends string> = {
  bla: T
}

interface a {
  msg: string
  gurt: number
}
interface b {
  bla: number
  msg: string
  f: Flap<'snurp'>
}
type ret = a | b

const helloWorld: BasedFunction<ret> = async (based, payload, ctx) => {
  return { msg: 'hello ' + payload.msg, bla: 0, f: { bla: 'snurp' } }
}

const lala: ret = {
  msg: 'lala',
  bla: 42,
  f: { bla: 'snurp' },
}

console.log(await helloWorld(null, lala, null))
