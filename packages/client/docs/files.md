## Files

Based provides a way to upload and serve user content without hassle using the `client.file()` API.  
Assets uploaded through this tool are then served through a global CDN network, which allows for caching and fast content-delivery.

An additional optimization step is executed when the user uploads a video or an image.
Images are optimized and compressed, and served through an image specific CDN, while videos get transcoded to multiple resolutions, in HLS format.

### Introduction

Files can be uploaded using the Based client, which in addition to uploading the file, also sets a node of type `file` on the database, which can then be queried and referenced, like you would for any other node.

This default type has several fields describing the file, including it's size, mime-type, timestamps for creation and update, progress status, and more. A crucial field is `src`, which contains a link that points to the file (through the appropriate CDN).

> :exclamation: Video files will take longer to become available due to the transcoding process.

### Usage

#### Upload

`client.file()` returns a promise that resolves with the new node's ID.

```js
import based from '@based/client'
const client = based({
  org: 'saulx',
  project: 'test',
  env: 'production',
})

const fileId = await client.file({
  contents: 'This is a string I want to store as plain text!',
  mimeType: 'text/plain',
  name: 'my-file-name',
})
```

The upload progress of the file can then be tracked by _observing_ the `progress` field of the resulting node.

#### Accessing the file

The file can be accessed by querying the database.

```js
const data = await client.get({
  $id: fileId,
  $all: true,
})
/*
data = {
  id: "fi6a535226",
  name: "eb3f67a3bc65325bf739ebddd94403e5(1).png",
  mimeType: "image/png",
  version: "eb3f67a3bc65325bf739ebddd94403e5",
  origin: "https://based-env-files-do-usproduction-enb-xz-apz--orn-t-v-...98446afcb87d.png",
  src: "https://based-2129034536588.imgix.net/fi6a535226/84e62df3-75...98446afcb87d.png",
  progress: 1,
  size: 61901,
  type: "file",
  createdAt: 1650360875043,
  updatedAt: 1650360882865,
}
*/
```

When using this API, one should always link to the file using the `src` field, since it's the one using the CDN. Pointing to the `origin` would lead to significantly higher data costs.
