import { BasedClient } from '@based/client'
import { logs, button, toggleButton, uploadButton } from './ui'

const init = async () => {
  const based = new BasedClient()

  based.connect({
    url: async () => {
      return 'ws://localhost:8081'
    },
  })

  button('Call hello', async () => {
    log('Call hello', await based.call('hello', { x: true }))
  })

  button('Fetch hello', async () => {
    log('Call hello', await (await fetch('http://localhost:8081/hello')).text())
  })

  button('Fetch stream files', async () => {
    const payload: any[] = []
    for (let i = 0; i < 2000; i++) {
      payload.push({
        i,
        bla: 'hello',
      })
    }
    log(
      'Fetch stream files',
      await (
        await fetch('http://localhost:8081/files', {
          method: 'post',
          body: JSON.stringify(payload),
          headers: {
            'content-type': 'application/json',
          },
        })
      ).text()
    )
  })

  // add number of files!
  uploadButton('Stream file', async (files, progress) => {
    log('uploading', files.length + ' files')
    const results = await Promise.all(
      [...files].map(async (f) => {
        const payload: any[] = []
        for (let i = 0; i < 2; i++) {
          payload.push({
            i,
            bla: 'hello',
          })
        }
        const x = await based.stream(
          'files',
          {
            contents: f,
            payload,
          },
          progress
        )
        return x
      })
    )
    results.forEach((r) => {
      r.correctPayload = r.payload.length === 2
      log(r)
      log(
        `<span><img style="height:150px" src="http://localhost:8081/file?id=${r.id}" /></span>`
      )
    })
  })

  // add number of files!
  uploadButton('Stream file large payload', async (files, progress) => {
    log('uploading', files.length + ' files')
    const results = await Promise.all(
      [...files].map(async (f) => {
        const payload: any[] = []
        for (let i = 0; i < 2e4; i++) {
          payload.push({
            i,
            bla: 'hello',
          })
        }
        const x = await based.stream(
          'files',
          {
            contents: f,
            payload,
          },
          (p) => {
            progress(p)
          }
        )
        return x
      })
    )
    results.forEach((r) => {
      log(
        'correct-payload',
        r.payload.length === 2e4,
        'array-length',
        r.payload.length
      )
      log(
        `<span><img style="height:150px" src="http://localhost:8081/file?id=${r.id}" /></span>`
      )
    })
  })

  uploadButton('Stream doesNotExist', async (files) => {
    try {
      await Promise.all(
        [...files].map(async (f) => {
          const x = await based.stream('doesNotExist', {
            contents: f,
          })
          return x
        })
      )
    } catch (err) {
      log(err)
    }
  })

  uploadButton('Stream brokenFiles', async (files, progress) => {
    const results = await Promise.allSettled(
      [...files].map(async (f) => {
        const x = await based.stream(
          'brokenFiles',
          {
            contents: f,
          },
          progress
        )
        return x
      })
    )
    log(results)
  })

  uploadButton('Stream notAllowedFiles', async (files, progress) => {
    const results = await Promise.allSettled(
      [...files].map(async (f) => {
        const x = await based.stream(
          'notAllowedFiles',
          {
            contents: f,
          },
          progress
        )
        return x
      })
    )
    log(results)
  })

  toggleButton('Disconnect', () => {
    based.disconnect()
    return () => {
      based.connect({
        url: async () => {
          return 'ws://localhost:8081'
        },
      })
    }
  })

  toggleButton('Counter', () => {
    return based.query('counter', { speed: 10 }).subscribe((d) => {
      log('Counter', d)
    })
  })

  toggleButton('Counter slow', () => {
    return based.query('counter', { speed: 1e3 }).subscribe((d) => {
      log('Counter slow', d)
    })
  })

  toggleButton(
    'Query fn persist',
    () => {
      return based
        .query('staticSub', { special: 1 }, { persistent: true })
        .subscribe((d) => {
          log('static Sub', d)
        })
    },
    true
  )

  toggleButton(
    'setAuthState',
    () => {
      based.setAuthState({
        token: 'power',
        persistent: true,
      })
      return () => {
        based.clearAuthState()
      }
    },
    !!based.authState.token
  )

  based.on('authstate-change', (d) => {
    log('authstate-change', d)
  })

  based.on('connect', (d) => {
    log('connect', d)
  })

  based.on('disconnect', (d) => {
    log('disconnect', d)
  })

  const log = logs()
}

init()
