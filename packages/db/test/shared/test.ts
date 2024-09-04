import picocolors from 'picocolors'

const test = async (name: string, fn: (t?: any) => Promise<void>) => {
  console.log(picocolors.gray(`\nstart ${name}`))
  const d = performance.now()
  const afters = []
  const t = {
    after: (fn) => {
      afters.push(fn)
    },
  }
  try {
    await fn(t)

    console.log(
      picocolors.green(`✓ ${name}`),
      picocolors.gray(`${Math.round((performance.now() - d) * 100) / 100} ms`),
    )
  } catch (err) {
    console.log(
      picocolors.red(`! ${name}`),
      picocolors.gray(`${Math.round((performance.now() - d) * 100) / 100} ms`),
    )

    const msg = err.stack.replaceAll('.js', '.ts').replaceAll('/dist/', '')
    console.log(picocolors.red(msg))
  }

  await Promise.all(afters.map((f) => f()))
}

test.skip = async (name: string, fn: (t?: any) => Promise<void>) => {
  console.log(picocolors.gray('skip ' + name))
}

export default test
