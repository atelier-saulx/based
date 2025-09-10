import { readUint32 } from '@based/utils'
import { Ctx } from './Ctx.js'

const promisify = (tmp: Tmp) => {
  if (!tmp.promise) {
    if (tmp.batch.ready) {
      const id = tmp.id
      if (id) {
        tmp.promise = Promise.resolve(id)
      } else {
        tmp.promise = Promise.reject(tmp.error)
      }
    } else {
      tmp.promise = new Promise((resolve, reject) => {
        tmp.resolve = resolve
        tmp.reject = reject
        tmp.batch.promises ??= []
        tmp.batch.promises.push(tmp)
      })
    }
  }
  return tmp.promise
}

export const resolveTmp = (tmp: Tmp) => {
  const id = tmp.id
  if (id) {
    tmp.resolve(tmp.id)
  } else {
    tmp.reject(tmp.error)
  }
}
export const rejectTmp = (tmp: Tmp) => {
  tmp.reject(tmp.error)
}

export class Tmp implements Promise<number> {
  constructor(ctx: Ctx) {
    ctx.batch.count ??= 0
    this.type = ctx.cursor.type
    this.batch = ctx.batch
    this.tmpId = ctx.batch.count++
  }
  [Symbol.toStringTag]: 'ModifyPromise'
  #id: number
  get error(): Error {
    if (this.batch.ready) {
      // TODO: also handle individual errors here
      return this.batch.error
    }
  }
  get id(): number {
    if (this.batch.ready) {
      this.#id ??= this.batch.res && readUint32(this.batch.res, this.tmpId * 5)
      return this.#id
    }
  }
  type: number
  tmpId: number
  batch: Ctx['batch']
  promise?: Promise<number>
  resolve?: (value: number | PromiseLike<number>) => void
  reject?: (reason?: any) => void
  then<Res1 = number, Res2 = never>(
    onfulfilled?: ((value: number) => Res1 | PromiseLike<Res1>) | null,
    onrejected?: ((reason: any) => Res2 | PromiseLike<Res2>) | null,
  ): Promise<Res1 | Res2> {
    return promisify(this).then(onfulfilled, onrejected)
  }
  catch<Res = never>(
    onrejected?: ((reason: any) => Res | PromiseLike<Res>) | null,
  ): Promise<number | Res> {
    return promisify(this).catch(onrejected)
  }
  finally(onfinally?: (() => void) | null): Promise<number> {
    return promisify(this).finally(onfinally)
  }
}
