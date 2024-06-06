export const prop = (
  obj: Object,
  field: string,
  settings: {
    get: () => any
    set?: () => any
  },
) => {
  Object.defineProperty(obj, field, {
    enumerable: true,
    set: settings.set ?? (() => undefined),
    get: settings.get,
  })
}
