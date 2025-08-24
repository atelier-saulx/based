import { Ctx } from './Ctx.js'

const promisify = (tmp: Tmp) => {
  if (!tmp.promise) {
    const id = tmp.id
    if (id) {
      tmp.promise = Promise.resolve(id)
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
  tmp.resolve(tmp.id)
}

export class Tmp implements PromiseLike<number> {
  constructor(ctx: Ctx) {
    this.type = ctx.cursor.type
    this.tmpId = ctx.id
    this.batch = ctx.batch
  }
  get id() {
    if (this.batch.offsets) {
      const offset = this.batch.offsets[this.type]
      return this.tmpId + offset
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
