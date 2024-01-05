import { Path } from '@saulx/utils'
import { BasedSetTarget } from '../../src/index.js'
import { ParseError } from '../../src/error'

export const resultCollect = (...results: BasedSetTarget[]) => {
  const assertableResults: { path: Path; value: any }[] = []
  for (let i = 0; i < results.length; i++) {
    assertableResults.push(
      ...results[i].collected.map((v) => ({ path: v.path, value: v.value }))
    )
  }
  return assertableResults
}

export const errorCollect = (...results: BasedSetTarget[]) => {
  const errors: { path: Path; code: ParseError }[] = []
  for (let i = 0; i < results.length; i++) {
    if (results[i].errors) {
      errors.push(...results[i].errors)
    }
  }
  return errors
}
