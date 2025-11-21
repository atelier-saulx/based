import * as fs from 'fs'
import * as path from 'path'
import { performance } from 'perf_hooks'
import { styleText } from 'util'
import { difference } from '../../../schema/dist/parse/semver/difference.js'

const MEASURES_PER_TEST = 10

type Options = {
  repeat?: number
  timeout?: number
  silent?: boolean
  outputFile?: string
}

type Result = {
  timestamp: string
  dbVersion: string
  label: string
  avgDurationMs: number
  totalDurationMs: number
  repetitions: number
  difference?: number
  previous?: number
}

type FileStructure = {
  [key: string]: Result[]
}

type Difference = {
  difference: number
  previous: number
}

export async function perf(
  fn: () => void | Promise<void>,
  label: string,
  options: Options = {},
): Promise<void> {
  const repeat = options.repeat ?? 1
  const timeout = options.timeout ?? 5000
  const silent = options.silent ?? false
  const testFileName = path.basename(process.env.TEST_FILENAME)
  const dbVersion = process.env.npm_package_version
  const outputFile =
    options.outputFile ?? `perf_${testFileName}_${dbVersion}.json`
  const outputDir = './tmp_perf_logs'
  const testFunction = process.env.TEST_TO_RUN ?? 'not inside a test'

  const durations: number[] = []

  try {
    for (let i = 0; i < repeat; i++) {
      const start = performance.now()

      await Promise.race([
        callWrapper(fn),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout of ${timeout}ms exceeded`)),
            timeout,
          ),
        ),
      ])

      const end = performance.now()
      durations.push(end - start)
    }

    const totalTime = durations.reduce((a, b) => a + b, 0)
    const avgTime = totalTime / durations.length

    const result: Result = {
      timestamp: new Date().toISOString(),
      dbVersion: dbVersion,
      label,
      avgDurationMs: Number(avgTime.toFixed(4)),
      totalDurationMs: Number(totalTime.toFixed(4)),
      repetitions: repeat,
    }

    const diff = await saveResultToFile(
      path.join(outputDir, outputFile),
      testFunction,
      result,
    )
    const percentDiff =
      diff.previous !== null ? (diff.difference / diff.previous) * 100 : 0
    const diffMessage =
      diff.difference > 0
        ? styleText(
            'red',
            `+${diff.difference.toFixed(2)} ms (${percentDiff.toFixed(1)}%)`,
          )
        : !isNaN(diff.difference)
          ? styleText(
              'green',
              `${diff.difference.toFixed(2)} ms (${percentDiff.toFixed(1)}%)`,
            )
          : ''
    if (!silent)
      console.log(
        styleText(
          'gray',
          `${styleText('bold', styleText('white', label))} Avg ${avgTime.toFixed(2)}ms, Total ${totalTime.toFixed(2)}ms (${repeat}x) ${diffMessage}.`,
        ),
      )
  } catch (err) {
    console.error(`Error in perf run "${label}":`, err)
    return
  }
}

async function callWrapper(fn: () => void | Promise<void>) {
  const result = fn()
  if (result && typeof (result as any).then === 'function') {
    await result
  }
}

async function saveResultToFile(
  filePath: string,
  testName: string,
  data: Result,
): Promise<Difference> {
  const absolutePath = path.resolve(filePath)
  let fileContent: FileStructure = {}

  try {
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath))
    }
    if (fs.existsSync(absolutePath)) {
      const content = fs.readFileSync(absolutePath, 'utf-8')
      fileContent = JSON.parse(content)
    }
  } catch (e) {
    fileContent = {}
  }

  if (!fileContent[testName]) {
    fileContent[testName] = []
  }

  const previous = fileContent[testName].slice(-1)[0]?.avgDurationMs
  const difference = data.avgDurationMs - previous
  data.difference = difference
  data.previous = previous

  fileContent[testName].push(data)

  if (fileContent[testName].length > MEASURES_PER_TEST) {
    fileContent[testName] = fileContent[testName].slice(-MEASURES_PER_TEST)
  }

  fs.writeFileSync(absolutePath, JSON.stringify(fileContent, null, 2))

  return { difference: difference, previous: previous }
}
