import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const root = document.getElementById('root')
if (!root) {
  document.body.innerHTML = '<h1 style="color:red">ERROR: #root element not found</h1>'
} else {
  ReactDOM.createRoot(root).render(<App />)
}
