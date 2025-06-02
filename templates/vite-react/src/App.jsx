import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Shipvibes Project</h1>
        <p>Your project is ready for development!</p>
        
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
          <p>
            Edit <code>src/App.jsx</code> and save to test HMR
          </p>
        </div>
        
        <p className="read-the-docs">
          Start editing your code and see changes in real-time!
        </p>
      </header>
    </div>
  )
}

export default App 