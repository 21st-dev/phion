import React from "react"

const colors = {
  blue: {
    backgroundColor: "bg-blue-700",
    fill: "fill-blue-1000 dark:fill-blue-100",
  },
  red: {
    backgroundColor: "bg-red-600",
    fill: "fill-red-1000 dark:fill-red-100",
  },
  amber: {
    backgroundColor: "bg-amber-700",
    fill: "fill-amber-1000 dark:fill-amber-100",
  },
  green: {
    backgroundColor: "bg-green-700",
    fill: "fill-green-1000 dark:fill-green-100",
  },
  teal: {
    backgroundColor: "bg-teal-700",
    fill: "fill-teal-1000 dark:fill-teal-100",
  },
  purple: {
    backgroundColor: "bg-purple-700",
    fill: "fill-purple-1000 dark:fill-purple-100",
  },
  pink: {
    backgroundColor: "bg-pink-700",
    fill: "fill-pink-1000 dark:fill-pink-100",
  },
  gray: {
    backgroundColor: "bg-gray-700",
    fill: "fill-gray-1000 dark:fill-gray-100",
  },
}

type TToggleColor = keyof typeof colors

interface ToggleProps {
  checked: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  size?: "small" | "large"
  color?: TToggleColor
  icon?: {
    checked: React.ReactNode
    unchecked: React.ReactNode
  }
  direction?: "switch-first" | "label-first"
  children?: React.ReactNode
}

const getClasses = (
  checked: boolean,
  disabled: boolean,
  size: "small" | "large",
  color?: TToggleColor,
) => {
  let toggle = "rounded-[14px] inline-block relative duration-150"
  let thumb =
    "rounded-[50%] border border-transparent absolute top-1/2 -translate-y-1/2 shadow-toggle duration-150 flex items-center justify-center"

  if (size === "small") {
    toggle += " h-3.5 w-7"
    thumb += " h-3 w-3"
  } else {
    toggle += " h-6 w-10"
    thumb += " h-[22px] w-[22px]"
  }

  if (checked) {
    if (size === "small") {
      thumb += " left-3.5"
    } else {
      thumb += " left-4"
    }

    if (disabled) {
      toggle += " bg-accents-1 border border-accents-2 cursor-not-allowed"
      thumb += " bg-gray-200"
    } else {
      toggle += ` ${
        color
          ? `bg-gray-100 ${colors[color].fill}`
          : "bg-success fill-gray-900 dark:fill-background-100"
      } border border-gray-alpha-400 cursor-pointer`
      thumb += " bg-background-100 dark:bg-gray-1000"
    }
  } else {
    if (disabled) {
      toggle += " bg-background-100 border border-gray-alpha-400 cursor-not-allowed"
      thumb += " bg-gray-200 left-0"
    } else {
      toggle += ` ${
        color
          ? `${colors[color].backgroundColor} ${colors[color].fill}`
          : "bg-background-100 fill-gray-900 dark:fill-background-100"
      } border border-gray-alpha-400 cursor-pointer`
      thumb += " bg-background-200 dark:bg-gray-1000 left-0"
    }
  }

  return { toggle, thumb }
}

export const Toggle = ({
  checked,
  onChange,
  disabled = false,
  size = "small",
  color,
  icon,
  direction = "label-first",
  children,
  ...rest
}: ToggleProps) => {
  return (
    <label
      className={`relative inline-flex gap-2 items-center py-[3px] text-xs text-secondary select-none${
        direction === "switch-first" ? " flex-row-reverse" : ""
      }`}
      {...rest}
    >
      {children && <span>{children}</span>}
      <input
        className="absolute w-0 h-0 appearance-none"
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={getClasses(checked, disabled, size, color).toggle}>
        <div className={getClasses(checked, disabled, size, color).thumb}>
          {icon && checked && icon.checked}
          {icon && !checked && icon.unchecked}
        </div>
      </span>
    </label>
  )
}
