import { getType, OperandTypes } from './index.js'

type RecurseFn<L> = (item: L) => Promise<boolean>
export type WalkerListFn<L> = (
  target: any,
  previousPath?: string
) => Promise<L[]>
type ItemMatchFn<L> = (item: L) => Promise<boolean>
type ListItem = { name: string; ref: any; path: string; type: OperandTypes }
export type WalkerTargetValidationFn = (target: any) => Promise<boolean>
type ItemFn = (
  item: any,
  info: {
    name: string
    path: string
    type: OperandTypes
  }
) => Promise<void>

export type Walk<L = ListItem, F = ItemFn> = (
  target: any,
  itemFn: F,
  options?: {
    listFn?: WalkerListFn<L>
    itemMatchFn?: ItemMatchFn<L>
    recurseFn?: RecurseFn<L>
    previousPath?: string
    targetValidationFn?: WalkerTargetValidationFn
  }
) => Promise<void>

const defaultItemMatchFn: ItemMatchFn<ListItem> = async (item) =>
  getType(item.ref) !== 'object'
const defaultListFn: WalkerListFn<ListItem> = async (target, previousPath) => {
  return Object.keys(target).map((key: string) => ({
    name: key,
    ref: target[key],
    path: [previousPath, key].filter(Boolean).join('/'),
    type: getType(target[key]),
  }))
}
const defaultRecurseFn: RecurseFn<ListItem> = async (item) =>
  getType(item.ref) === 'object'
const defaultTargetValidationFn: WalkerTargetValidationFn = async (target) =>
  getType(target) === 'object'

export const walk: Walk = async (target, itemFn, options) => {
  options = {
    listFn: defaultListFn,
    itemMatchFn: defaultItemMatchFn,
    recurseFn: defaultRecurseFn,
    targetValidationFn: defaultTargetValidationFn,
    ...options,
  }
  if (
    getType(options.targetValidationFn) === 'function' &&
    !(await options.targetValidationFn?.(target))
  )
    return
  ;['listFn', 'itemMatchFn', 'recurseFn'].forEach((fn: string) => {
    // @ts-ignore
    if (getType(options?.[fn]) !== 'function')
      throw new Error(fn + ' should be a function')
  })

  const items = await options?.listFn?.(target, options.previousPath)
  if (!items) {
    return
  }
  await Promise.all(
    items.map(async (item) => {
      const { name, path, type } = item
      if (await options?.itemMatchFn?.(item)) {
        await itemFn(item.ref, { name, path, type })
      }
      if (await options?.recurseFn?.(item)) {
        await walk(item.ref, itemFn, {
          ...options,
          previousPath: item.path,
        })
      }
    })
  )
}
