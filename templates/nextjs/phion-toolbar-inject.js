if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Load Phion toolbar
  const script = document.createElement("script")
  script.src = "/@phion/toolbar.js"
  script.async = true
  document.head.appendChild(script)
}
