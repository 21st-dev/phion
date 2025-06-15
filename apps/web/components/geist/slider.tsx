import React, { useEffect, useState } from "react"

interface SliderProps {
  onValueChange: React.Dispatch<React.SetStateAction<number>>
  value: number
}

export const Slider = ({ onValueChange, value }: SliderProps) => {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    let theme
    if (typeof window === "undefined") {
      theme = "system"
    } else {
      theme = localStorage.getItem("theme") || "system"
    }

    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      setIsDarkMode(prefersDark)
    } else {
      setIsDarkMode(theme === "dark")
    }
  }, [])

  return (
    <div className="w-full">
      <div className="relative flex justify-center items-center mb-4">
        <style jsx>
          {`
            .geist-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 6px;
              height: 14px;
              background: white;
              cursor: pointer;
              border-radius: 1px;
              box-shadow:
                0 0 0 1px rgba(0, 0, 0, 0.21),
                0 1px 2px rgba(0, 0, 0, 0.04);
              transition:
                box-shadow 0.2s,
                background 0.2s,
                transform 0.2s;
            }

            .geist-slider::-moz-range-thumb {
              appearance: none;
              width: 6px;
              height: 14px;
              background: white;
              cursor: pointer;
              border-radius: 1px;
              border: none;
              box-shadow:
                0 0 0 1px rgba(0, 0, 0, 0.21),
                0 1px 2px rgba(0, 0, 0, 0.04);
              transition:
                box-shadow 0.2s,
                background 0.2s,
                transform 0.2s;
            }
          `}
        </style>
        <input
          type="range"
          min="1"
          max="100"
          value={value}
          onChange={(event) => onValueChange(parseInt(event.target.value, 10))}
          className="geist-slider w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none"
          style={{
            background: `linear-gradient(to right, #006bff ${value}%, ${
              isDarkMode ? "#1f1f1f" : "#ebebeb"
            } ${value}%)`,
          }}
        />
      </div>
    </div>
  )
}
