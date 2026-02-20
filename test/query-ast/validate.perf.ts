import * as v from 'valibot'
import { type } from 'arktype'
import test from '../shared/test.js'

// ==========================================
// 1. DATA GENERATION
// ==========================================
const validData = {
  captchaToken: 'valid_token_123',
  metadata: {
    votes: { ddi_1: 100, ddi_2: 200, ddi_3: 300, ddi_4: 400 },
    editionId: 999,
  },
}

// ==========================================
// 2. RAW JS VALIDATOR
// ==========================================
function manualValidator(data: any): boolean {
  if (!data || typeof data !== 'object') return false

  if (typeof data.captchaToken !== 'string' && data.captchaToken !== null)
    return false

  const metadata = data.metadata
  if (!metadata || typeof metadata !== 'object') return false

  if (
    typeof metadata.editionId !== 'number' ||
    metadata.editionId < 0 ||
    metadata.editionId > 4294967295 ||
    !Number.isInteger(metadata.editionId)
  )
    return false

  const votes = metadata.votes
  if (!votes || typeof votes !== 'object') return false

  for (const key in votes) {
    const val = votes[key]
    if (
      typeof val !== 'number' ||
      val < 0 ||
      val > 4294967295 ||
      !Number.isInteger(val)
    )
      return false
  }

  return true
}

// ==========================================
// 3. SCHEMA FACTORIES
// ==========================================

const createValibotSchema = () => {
  return v.object({
    captchaToken: v.nullable(v.string()),
    metadata: v.object({
      editionId: v.pipe(
        v.number(),
        v.integer(),
        v.minValue(0),
        v.maxValue(4294967295),
      ),
      votes: v.record(
        v.string(),
        v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4294967295)),
      ),
    }),
  })
}

const createArkTypeSchema = () => {
  return type({
    captchaToken: 'string|null',
    metadata: {
      editionId: '0<=number<=4294967295%1',
      votes: {
        '[string]': '0<=number<=4294967295%1',
      },
    },
  })
}

// ==========================================
// 4. BENCH RUNNERS
// ==========================================

function measureCreation(name: string, factory: () => any, iterations: number) {
  if (global.gc) global.gc()
  const startMem = process.memoryUsage().heapUsed
  const start = process.hrtime.bigint()

  const schemas: any[] = []
  for (let i = 0; i < iterations; i++) {
    schemas.push(factory())
  }

  const end = process.hrtime.bigint()
  const endMem = process.memoryUsage().heapUsed
  const totalTimeNs = Number(end - start)
  const totalMemDiff = endMem - startMem
  const memPerOp = totalMemDiff / iterations // bytes

  const opsPerSec = (iterations / totalTimeNs) * 1e9
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

  // Keep schemas alive to prevent GC during measurement
  // console.log(schemas.length)

  console.log(
    `${name.padEnd(10)} | Creation: ${formatter.format(
      opsPerSec,
    )} ops/sec | Mem: ${memPerOp.toFixed(2)} bytes/inst`,
  )
}

function runValidationBenchmark(
  name: string,
  fn: () => void,
  iterations: number = 500_000,
) {
  process.stdout.write(`Running validation ${name}... `)

  // 1. Warmup (Trigger JIT optimization)
  for (let i = 0; i < 1e5; i++) {
    fn()
  }

  // 2. Garbage Collection (Optional: helps stability if using standard node flags)
  if (global.gc) global.gc()

  // 3. Measure
  const start = Date.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const end = Date.now()

  const totalTimeMs = end - start
  const opsPerSec = (iterations / totalTimeMs) * 1000

  // Format Output
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  })
  console.log(`${formatter.format(opsPerSec)} ops/sec (${totalTimeMs}ms)`)
}

test('bench validator', async () => {
  const ValibotSchema = createValibotSchema()
  const ArkTypeSchema = createArkTypeSchema()

  console.log('--- CREATION BENCHMARK ---\n')
  const CREATION_ITERATIONS = 10_000
  measureCreation('ArkType', createArkTypeSchema, CREATION_ITERATIONS)
  measureCreation('Valibot', createValibotSchema, CREATION_ITERATIONS)

  console.log('\n--- VALIDATION BENCHMARK ---\n')

  // Sanity Checks
  if (!manualValidator(validData)) throw new Error('Manual Failed')
  if (!v.safeParse(ValibotSchema, validData).success)
    throw new Error('Valibot Failed')
  if (ArkTypeSchema(validData) instanceof type.errors)
    throw new Error('ArkType Failed')

  const ITERATIONS = 10_000_000

  runValidationBenchmark(
    'Raw JS   ',
    () => manualValidator(validData),
    ITERATIONS,
  )
  runValidationBenchmark(
    'ArkType  ',
    () => ArkTypeSchema(validData),
    ITERATIONS,
  )
  runValidationBenchmark(
    'Valibot  ',
    () => v.parse(ValibotSchema, validData),
    ITERATIONS,
  )

  console.log('\n--- DONE ---')
})
