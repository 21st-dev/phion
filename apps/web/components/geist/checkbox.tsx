import React from "react"

interface CheckboxProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  indeterminate?: boolean
  children?: React.ReactNode
}

const getInputClasses = (checked: boolean, disabled: boolean, indeterminate: boolean) => {
  let className =
    "relative border w-4 h-4 duration-200 rounded inline-flex items-center justify-center"
  if (disabled) {
    if (!checked || indeterminate) {
      className += " bg-gray-100 border-gray-500"
      if (indeterminate) {
        className += " stroke-gray-500"
      } else {
        className += " fill-gray-100 stroke-gray-100"
      }
    } else {
      className += " bg-gray-600 border-gray-600 fill-gray-600 stroke-gray-100"
    }
  } else {
    if (!checked || indeterminate) {
      className += " bg-background-100 border-gray-700 group-hover:bg-gray-200"
      if (indeterminate) {
        className += " stroke-gray-700"
      } else {
        className +=
          " fill-background-100 stroke-background-100 group-hover:stroke-gray-200 group-hover:fill-gray-200"
      }
    } else {
      className += " bg-gray-1000 border-gray-1000 fill-gray-1000 stroke-gray-100"
    }
  }

  return className
}

export const Checkbox = ({
  checked = false,
  onChange,
  disabled = false,
  indeterminate = false,
  children,
}: CheckboxProps) => {
  return (
    <div
      className={`flex items-center cursor-pointer text-[13px] font-sans group ${
        disabled ? "text-gray-500" : "text-gray-1000"
      }`}
      onClick={() => onChange && !indeterminate && onChange(!checked)}
    >
      <input
        disabled={disabled}
        type="checkbox"
        checked={checked}
        className="absolute w-[1px] h-[1px] p-0 overflow-hidden whitespace-nowrap border-none"
      />
      <span className={getInputClasses(checked, disabled, indeterminate)}>
        <svg className="shrink-0" height="16" viewBox="0 0 20 20" width="16">
          {indeterminate ? (
            <line
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              x1="5"
              x2="15"
              y1="10"
              y2="10"
            />
          ) : (
            <path
              d="M14 7L8.5 12.5L6 10"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          )}
        </svg>
      </span>
      <span className="ml-2">{children}</span>
    </div>
  )
}
