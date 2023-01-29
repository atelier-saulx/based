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

  toggleButton('setAuthState', () => {
    based.setAuthState({
      token: 'power',
    })
    return () => {
      based.clearAuthState()
    }
  })

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
