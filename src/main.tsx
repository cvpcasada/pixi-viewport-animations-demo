import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { createLogger } from '@evilkiwi/logger';

const loggerA = createLogger({
  name: 'module-a',
  color: '#FF0000',

});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
