import React from 'react'
import * as ok from './a'
import favicon from './favicon.ico'
// import pkg from "../../../../package.json"

document.body.innerHTML = 'supercool'

const img = document.createElement('img')
img.src = favicon

document.body.appendChild(img)
