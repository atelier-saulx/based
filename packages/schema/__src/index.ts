import {
  flatten,
  getDotPath,
  safeParse,
  summarize,
  type BaseIssue,
  // summarize,
  type InferInput,
  type InferOutput,
  type IssuePathItem,
} from 'valibot'
import { schema } from './schema.js'
// import { flatten } from 'flat'

export type Schema = InferInput<typeof schema>
export type StrictSchema = InferOutput<typeof schema>

export const parse = (def: Schema): StrictSchema => {
  const { output, success, issues } = safeParse(schema, def)
  if (success) {
    return output
  } else {
    // const walk = (next: typeof issues) => {
    //   let tree
    //   for (const item of next) {
    //     if (item.path) {
    //       const key = item.path.map(({ key }) => key).join('.')
    //       const val =
    //         (item.issues && walk(item.issues)) || item.path.at(-1)?.value
    //       tree ??= {}
    //       tree[key] = val
    //     }
    //   }
    //   return tree
    // }

    // console.log(flatten(issues))

    // console.dir(flatten(walk(issues)), { depth: null })
    console.info(summarize(issues))

    // let next: typeof issues = issues
    // const path: IssuePathItem[] = []
    // while (true) {
    //   const issue = next.at(-1)
    //   if (issue) {
    //     if (issue.path) {
    //       path.push(...issue.path)
    //     }
    //     if (issue.issues) {
    //       next = issue.issues
    //     } else {
    //       break
    //     }
    //   }
    // }
    // const msg = `${path.map(({ key }) => key).join('.')}: ${path.at(-1)?.value}`
    // console.log({ msg })
    // // console.dir(issues, { depth: null })
    // // console.log('----')
    // // console.log(summarize(issues))
    throw 'err!!'
  }
}
