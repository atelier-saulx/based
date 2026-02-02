import * as v from 'valibot'
import { type } from 'arktype'

// ==========================================
// 1. DATA GENERATION
// ==========================================
const validData = {
  name: 'Performance Master',
  id: 123456789,
  isNice: true,
  tags: [100, 200, 300, 400, 500],
}

// ==========================================
// 2. RAW JS VALIDATOR
// ==========================================
function manualValidator(data: any): boolean {
  if (!data || typeof data !== 'object') return false

  if (typeof data.name !== 'string' || data.name.length > 30) return false

  if (typeof data.id !== 'number' || data.id < 0 || data.id > 4000000000)
    return false

  if (typeof data.isNice !== 'boolean') return false

  const tags = data.tags
  if (!Array.isArray(tags) || tags.length > 10) return false
  for (let i = 0; i < tags.length; i++) {
    const t = tags[i]
    if (typeof t !== 'number' || t < 0 || t > 4000) return false
  }

  return true
}

// ==========================================
// 3. VALIBOT SCHEMA
// ==========================================
const ValibotSchema = v.object({
  name: v.pipe(v.string(), v.maxLength(30)),
  id: v.pipe(v.number(), v.minValue(0), v.maxValue(4000000000)),
  isNice: v.boolean(),
  tags: v.pipe(
    v.array(v.pipe(v.number(), v.minValue(0), v.maxValue(4000))),
    v.maxLength(10),
  ),
})

// ==========================================
// 4. ARKTYPE SCHEMA
// ==========================================
const ArkTypeSchema = type({
  name: 'string<=30',
  id: '0<=number<=4000000000',
  isNice: 'boolean',
  tags: '(0<=number<=4000)[] <= 10',
})

// ==========================================
// 5. SIMPLE BENCH RUNNER
// ==========================================

function runBenchmark(
  name: string,
  fn: () => void,
  iterations: number = 500_000,
) {
  process.stdout.write(`Running ${name}... `)

  // 1. Warmup (Trigger JIT optimization)
  for (let i = 0; i < 1000; i++) {
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
  const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  console.log(`${formatter.format(opsPerSec)} ops/sec (${totalTimeMs}ms)`)
}

// ==========================================
// 6. EXECUTION
// ==========================================

console.log('--- STARTING BENCHMARK ---\n')

// Sanity Checks
if (!manualValidator(validData)) throw new Error('Manual Failed')
if (!v.safeParse(ValibotSchema, validData).success)
  throw new Error('Valibot Failed')
if (ArkTypeSchema(validData) instanceof type.errors)
  throw new Error('ArkType Failed')

const ITERATIONS = 10_000_000

runBenchmark('Raw JS   ', () => manualValidator(validData), ITERATIONS)
runBenchmark('ArkType  ', () => ArkTypeSchema(validData), ITERATIONS)
runBenchmark('Valibot  ', () => v.parse(ValibotSchema, validData), ITERATIONS)

console.log('\n--- DONE ---')
