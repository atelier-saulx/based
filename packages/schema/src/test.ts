// const isVectorBAseType = (v: unknown): v is string =>
//   isNumberType(v) || v === 'float32' || v === 'float64'
// const isNumberType = (v: unknown): v is string => {
//   switch (v) {
//     case 'number':
//     case 'int8':
//     case 'uint8':
//     case 'int16':
//     case 'uint16':
//     case 'uint32':
//       return true
//   }
// }
// const isPositiveInt = (v: unknown): v is number =>
//   isNumber(v) && v > 0 && Number.isInteger(v)
// const isFn = (v: unknown): v is Function => typeof v === 'function'
// const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
// const isNumber = (v: unknown): v is number => typeof v === 'number'
// const isString = (v: unknown): v is string => typeof v === 'string'
// const isObj = (v: unknown): v is object => v !== null && typeof v === 'object'
// const isDate = (v: unknown) => !isNaN(new Date(v as number).getTime())
// const isEnumVal = (v: unknown) => isNumber(v) || isString(v) || isBool(v)

// import { Validation } from './index.js'

const boolean = (val: boolean) => typeof val === 'boolean'
const string = (val: string) => typeof val === 'string'

class Hooks {
  aNumber?(val: number) {}
}

export type SchemaPropHooks = ValidatorToType<Hooks>

class Base {
  required? = boolean
  title? = string
  description? = string
  //   validation? = (val: Validation) => typeof val === 'function'
  hooks? = Hooks
}

class Cardinality extends Base {
  type: 'cardinality'
  maxBytes?(val: number) {}
}

class Boolean extends Base {}

class Type {
  props(val: Record<string, ValidatorToType<Cardinality | Boolean>>) {}
}

class Schema {
  types(val: Record<string, ValidatorToType<Type>>) {}
}

// class Reference extends Base {
//     constructor (props) {
//         for (const i in props) {
//             if (i[0] === '$') {

//             }
//         }

//         super()
//     }
// }

// function reference (prop: ) {

// }

// function schema4 (schema: ) {

// }

// const schema2 = {
//     types () {

//     }
// }

type ValidatorToType<T> = {
  [K in keyof T]: NonNullable<T[K]> extends new (...args: any[]) => any // Is the property a class constructor itself? // --- 1. Class Constructor Check (NEW) ---
    ? // If YES: Get its instance type and recursively transform it
      ValidatorToType<InstanceType<NonNullable<T[K]>>>
    : // --- 2. Method Check (Same as before, but now second) ---
      // Is it a regular method (function)?
      T[K] extends ((arg: any) => any) | undefined
      ? // If YES: Get the type of its first parameter
        Parameters<NonNullable<T[K]>>[0]
      : // --- 3. Primitive/Array Check (Stops recursion) ---
        NonNullable<T[K]> extends
            | string
            | number
            | boolean
            | symbol
            | null
            | (infer A)[]
        ? T[K] // Keep the original type
        : // --- 4. Object Instance Check (For recursion) ---
          // Is it a plain object (like an *instance* of a class)?
          T[K] extends object | undefined
          ? ValidatorToType<NonNullable<T[K]>> // Recurse
          : // --- 5. Fallback ---
            T[K]
}

// const haha: ValidatorToType<Cardinality> = {
//   maxBytes: 1,
//   hooks: {
//     aNumber: 1,
//   },
// }

// const schema: ValidatorToType<Schema> = {
//   types: {
//     youzi: {
//       props: {
//         snurk: {
//           type: 'cardinality',
//           maxBytes: 1,
//         },
//       },
//     },
//   },
// }

// const record: any = {}

// const schema5 = {
//   types: record(string, {
//     props: {},
//   }),
// }

// class Reference {
//   [key: `$${string}`]: string
//   name? = (val: string) => typeof val === 'string'
//   static ['^\$'] = (val: string) => true
//   static obj = {

//   }
// }

// const t: ValidatorToType<Reference> = {
//   $edge: 'ballz',
// }

// const v = new Reference()

// // for (const i in v) {
// //   console.log(i, v)

// // }

// console.log(Object.getOwnPropertyNames(v.constructor).map((key) => v[key]))
// // console.log(v)

const schemaX = {
  types: {},
}
