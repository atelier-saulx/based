import * as fs from 'fs/promises'
import * as path from 'path'
import { performance } from 'perf_hooks'
import { styleText } from 'util'

const MEASURES_PER_TEST = 10

type Options = {
  repeat?: number
  timeout?: number
  silent?: boolean
  outputFile?: string
  diffThreshold?: number
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
  isDebugMode?: boolean
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
): Promise<number> {
  const repeat = options.repeat ?? 1
  const timeout = options.timeout ?? 5000
  const silent = options.silent ?? false
  const diffThreshold = options.diffThreshold ?? 10 // 10%
  const testFileName = path.basename(process.env.TEST_FILENAME)
  const dbVersion = process.env.npm_package_version
  const outputFile =
    options.outputFile ?? `perf_${testFileName}_${dbVersion}.json`
  const outputDir = './tmp_perf_logs'
  const testFunction = process.env.TEST_NAME ?? 'not inside a test'

  const durations: number[] = []
  let timeOut: ReturnType<typeof setTimeout>
  try {
    for (let i = 0; i < repeat; i++) {
      const start = performance.now()
      clearTimeout(timeOut)

      await Promise.race([
        callWrapper(fn),
        new Promise(
          (_, reject) =>
            (timeOut = setTimeout(
              () => reject(new Error(`Timeout of ${timeout}ms exceeded`)),
              timeout,
            )),
        ),
      ])

      const end = performance.now()
      durations.push(end - start)
    }

    clearTimeout(timeOut)

    const totalTime = durations.reduce((a, b) => a + b, 0)
    const avgTime = totalTime / durations.length

    const scriptName = process.env.npm_lifecycle_event || ''

    const isDebugMode = scriptName.includes('debug')

    const result: Result = {
      timestamp: new Date().toISOString(),
      dbVersion: dbVersion,
      label,
      avgDurationMs: Number(avgTime.toFixed(4)),
      totalDurationMs: Number(totalTime.toFixed(4)),
      repetitions: repeat,
      isDebugMode: isDebugMode,
    }

    const diff = await saveResultToFile(
      path.join(outputDir, outputFile),
      testFunction,
      label,
      result,
    )
    const percentDiff =
      diff.previous !== undefined ? (diff.difference / diff.previous) * 100 : 0

    let diffMessage = styleText('gray', ` no previous found`)

    if (!isNaN(diff.difference)) {
      if (Math.abs(percentDiff) > diffThreshold) {
        diffMessage =
          diff.difference >= 0
            ? styleText(
                'red',
                ` +${diff.difference.toFixed(2)} ms (${percentDiff.toFixed(1)}%)`,
              )
            : styleText(
                'green',
                ` ${diff.difference.toFixed(2)} ms (${percentDiff.toFixed(1)}%)`,
              )
      } else {
        diffMessage = styleText('gray', ` similar performance`)
      }
    }
    if (!silent)
      console.log(
        styleText(
          'gray',
          `${styleText('bold', styleText('white', label))} Avg ${avgTime.toFixed(2)}ms, Total ${totalTime.toFixed(2)}ms (${repeat}x)${diffMessage}`,
        ),
      )
    return totalTime
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
  label: string,
  data: Result,
): Promise<Difference> {
  const absolutePath = path.resolve(filePath)
  let fileContent: FileStructure = {}

  try {
    if (!(await fs.stat(path.dirname(filePath)).catch(() => {}))) {
      await fs.mkdir(path.dirname(filePath))
    }
    const content = await fs.readFile(absolutePath, 'utf-8')
    fileContent = JSON.parse(content)
  } catch (e) {
    fileContent = {}
  }

  if (!fileContent[testName]) {
    fileContent[testName] = []
  }

  const previous = fileContent[testName]
    .filter((m) => m.label == label)
    .slice(-1)[0]?.avgDurationMs
  const difference = data.avgDurationMs - previous
  data.difference = difference
  data.previous = previous

  fileContent[testName].push(data)

  if (
    fileContent[testName].filter((m) => m.label == label).length >
    MEASURES_PER_TEST
  ) {
    fileContent[testName] = fileContent[testName]
      .filter((m) => m.label == label)
      .slice(-MEASURES_PER_TEST)
  }

  await fs.writeFile(absolutePath, JSON.stringify(fileContent, null, 2))

  return { difference: difference, previous: previous }
}
