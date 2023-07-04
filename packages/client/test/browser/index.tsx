import { BasedClient } from '@based/client'
import { logs, button, toggleButton, uploadButton } from './ui'

const init = async () => {
  const based = new BasedClient({
    url: 'ws://localhost:8081',
    // cluster: 'local',
    // project: 'test',
    // env: 'framma',
    // org: 'saulx',
  })

  button('Call longWait', async () => {
    log('Call longWait', await based.call('longWait', { x: true }))
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

    const url =
      based.connection.ws.url
        .replace('wss://', 'https://')
        .split('/')
        .slice(0, -1)
        .join('/') + '/db:file-upload'

    // 'http://localhost:8081/files'

    log(
      'Fetch stream files',
      await (
        await fetch(url, {
          method: 'post',
          body: JSON.stringify(payload),
          headers: {
            'content-type': 'application/json',
          },
        })
      ).text()
    )
  })

  uploadButton('Stream basic', async (files, progressHandler) => {
    const body = new global.FormData()
    const url = 'http://localhost:8083'
    body.append('file', files[0])
    console.info('go go go', files)
    const xhr = new global.XMLHttpRequest()
    xhr.upload.onprogress = (p: ProgressEvent) => {
      const progress =
        // @ts-ignore
        (p.loaded || p.position) / (p.totalSize || p.total)

      console.info(progress)
      progressHandler(progress)
    }
    xhr.onerror = (p) => {
      console.error(p)
    }
    xhr.timeout = 1e3 * 60 * 60 * 24
    xhr.onabort = () => {
      console.error('abort')
    }
    xhr.ontimeout = () => {
      console.error('on timeout')
    }
    xhr.onload = () => {
      console.info('LOAD!')
    }
    console.log('???', url)
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', 'multipart/form-data')
    xhr.send(body)
  })

  // add number of files!
  uploadButton('Stream file to s3', async (files, progress) => {
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
          'db:file-upload',
          // 'files-s3',
          {
            contents: f,
            payload,
          },
          progress
        )
        return x
      })
    )

    results.forEach(async (r) => {
      // const x = r

      const x = await based
        .query('db', {
          $id: r.id,
          $all: true,
        })
        .get()

      log(x)
      log(`<span><img style="height:150px" src="${x.src ?? x.url}" /></span>`)
    })
  })

  // add number of files!
  uploadButton('Stream file STREAMY', async (files, progress) => {
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
          'streamy',
          {
            contents: f,
            payload,
          },
          progress
        )
        console.log('x= ', x)
        log('x =', JSON.stringify(x, null, 2))
        based
          .query('db', {
            $id: x.id,
            $all: true,
            //   $list: {
            //     $find: {
            //       $traverse: 'descendants',
            //       $filter: { $field: 'type', $value: 'file', $operator: '=' },
            //     },
            // },
          })
          .subscribe((data) => log(data))

        log(x)
        return x
      })
    )
    results.forEach((r) => {
      if (typeof r === 'string') {
        return
      }

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
    return based
      .query('counter', { speed: 1e3 }, { persistent: true })
      .subscribe((d) => {
        log('Counter slow', d)
      })
  })

  toggleButton('Query fn persist', () => {
    return based
      .query('staticSub', { special: 1 }, { persistent: true })
      .subscribe((d) => {
        log('static Sub', d)
      })
  })

  toggleButton('Query fn persist HUGE', () => {
    return based
      .query('staticSubHuge', { special: 1 }, { persistent: true })
      .subscribe((d, checksum) => {
        // @ts-ignore
        window.download = () => {
          const blob = new Blob([JSON.stringify(d)], {
            type: 'text/plain;charset=utf-8',
          })
          const url = window.URL || window.webkitURL
          const link = url.createObjectURL(blob)
          const a = document.createElement('a')
          a.download = 'HUGEFile.json'
          a.href = link
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }

        log(
          'static Sub Huge is there!',
          d.length / 1000 + 'k items',
          'checksum',
          checksum,
          '<a style="text-decoration:underline;" onclick="window.download()">Download the file</a>'
        )
      })
  })

  console.log('--->', based.authState.token)

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
