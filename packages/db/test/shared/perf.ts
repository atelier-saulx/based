import * as fs from 'fs'
import * as path from 'path'
import { performance } from 'perf_hooks'

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
  //   testName: string
  avgDurationMs: number
  totalDurationMs: number
  repetitions: number
}

type FileStructure = {
  [key: string]: Result[]
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
  console.log(process.env.TEST_TMP_DIR, outputDir)
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

    console.log('🦋', outputFile, { [testFunction]: result })
    await saveResultToFile(
      path.join(outputDir, outputFile),
      testFunction,
      result,
    )
    if (!silent) console.log('🎃')
  } catch (err) {
    console.error(`Error in perf run "${label}":`, err)
    return
  }
}

async function callWrapper(fn: () => void | Promise<void>) {
  const result = fn()
  if (result instanceof Promise) {
    await result
  }
}

async function saveResultToFile(
  filePath: string,
  testName: string,
  data: Result,
) {
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

  fileContent[testName].push(data)

  if (fileContent[testName].length > MEASURES_PER_TEST) {
    fileContent[testName] = fileContent[testName].slice(-MEASURES_PER_TEST)
  }

  fs.writeFileSync(absolutePath, JSON.stringify(fileContent, null, 2))
}
