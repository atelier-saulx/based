import React from 'react'
import { createRoot } from 'react-dom/client'
import { Table } from './components/table.js'

export default function App() {
  console.log('xx')
  return <Table height={innerHeight} width={innerWidth} type="user" />
}

createRoot(document.getElementById('root')).render(<App />)
