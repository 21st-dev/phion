import { TwentyFirstToolbar } from "@21st-extension/toolbar-react"
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <TwentyFirstToolbar />
  </React.StrictMode>,
)
