import test from 'ava'
import { pathToQuery, getValueByPath } from '../src/util'

test('pathToQuery should create an object structure out of a path', (t) => {
  t.deepEqual(pathToQuery(['level1', 'level2', 'level3', 'level4'], true), {
    level1: {
      level2: {
        level3: {
          level4: true
        }
      }
    }
  })
})

test('getValueByPath', (t) => {
  t.is(getValueByPath({
    level1: 123
  }, ['level1']), 123)
  t.is(getValueByPath({
    level1: 123
  }, 'level1'), 123)

  t.is(getValueByPath({
    level1: {
      level2: {
        level3: {
          level4: 456
        }
      }
    }
  }, ['level1', 'level2', 'level3', 'level4']), 456)
  t.is(getValueByPath({
    level1: {
      level2: {
        level3: {
          level4: 456
        }
      }
    }
  }, 'level1.level2.level3.level4'), 456)

  t.deepEqual(getValueByPath({
    level1: {
      level2: {
        level3: {
          level4: 456
        }
      }
    }
  }, ['level1', 'level2']), { level3: { level4: 456 } })

  t.deepEqual(getValueByPath(undefined, undefined), undefined)
  t.deepEqual(getValueByPath(undefined, ['nonExisting']), undefined)
  t.deepEqual(getValueByPath({ level1: { level2: 123 } }, ['nonExisting', 'none']), undefined)
  t.deepEqual(getValueByPath({}, ['nonExisting', 'none']), undefined)
})


