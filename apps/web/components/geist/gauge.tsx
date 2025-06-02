import React from "react";

const sizes = {
  tiny: 20,
  small: 32,
  medium: 64,
  large: 128,
};

type TArcPriority = "default" | "equal";

interface GaugeProps {
  size?: keyof typeof sizes;
  value: number;
  colors?: { [name: string]: string };
  showValue?: boolean;
  arcPriority?: TArcPriority;
  indeterminate?: boolean;
}

const gapPercent = {
  tiny: 9,
  small: 6,
  medium: 5,
  large: 5,
};

const rotate = {
  primary: {
    default: {
      tiny: `-rotate-90`,
      small: `-rotate-90`,
      medium: `-rotate-90`,
      large: `-rotate-90`,
    },
    equal: {
      tiny: `rotate-[calc(-90deg_+_(0.5*9*3.6deg))]`,
      small: `rotate-[calc(-90deg_+_(0.5*6*3.6deg))]`,
      medium: `rotate-[calc(-90deg_+_(0.5*5*3.6deg))]`,
      large: `rotate-[calc(-90deg_+_(0.5*5*3.6deg))]`,
    },
  },
  secondary: {
    default: {
      tiny: `rotate-[calc(1turn_-_90deg_-_(9*3.6deg))]`,
      small: `rotate-[calc(1turn_-_90deg_-_(6*3.6deg))]`,
      medium: `rotate-[calc(1turn_-_90deg_-_(5*3.6deg))]`,
      large: `rotate-[calc(1turn_-_90deg_-_(5*3.6deg))]`,
    },
    equal: {
      tiny: `rotate-[calc(1turn_-_90deg_-_(0.5*9*3.6deg))]`,
      small: `rotate-[calc(1turn_-_90deg_-_(0.5*6*3.6deg))]`,
      medium: `rotate-[calc(1turn_-_90deg_-_(0.5*5*3.6deg))]`,
      large: `rotate-[calc(1turn_-_90deg_-_(0.5*5*3.6deg))]`,
    },
  },
};

const defaultColors = {
  "0": "#e2162a",
  "34": "#ffae00",
  "68": "#00ac3a",
};

export const Gauge = ({
  size = "medium",
  value,
  colors = defaultColors,
  showValue = false,
  arcPriority = "default",
  indeterminate = false,
}: GaugeProps) => {
  const r = size === "tiny" ? 42.5 : 45;
  const circumference = 2 * r * Math.PI;
  const primary = colors?.primary
    ? colors?.primary
    : colors[
        Math.max(
          ...Object.keys(colors)
            .map(Number)
            .filter((key) => key <= value)
        ).toString()
      ];

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      className="relative"
      role="progressbar"
    >
      <svg
        aria-hidden="true"
        fill="none"
        height={sizes[size]}
        width={sizes[size]}
        viewBox="0 0 100 100"
        strokeWidth="2"
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          strokeWidth="10"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${
            rotate.secondary[arcPriority][size]
          } scale-y-[-1] origin-center${
            !colors?.secondary ? " stroke-gray-alpha-400" : ""
          }`}
          stroke={colors.secondary}
          strokeDasharray={`${
            indeterminate
              ? circumference
              : arcPriority === "default"
              ? (circumference *
                  (100 - (value === 0 ? 0 : 2 * gapPercent[size]) - value)) /
                100
              : (circumference * (100 - 2 * gapPercent[size])) / 100 / 2
          } ${circumference}`}
        />
        {(value > 0 || arcPriority === "equal") && !indeterminate && (
          <circle
            cx="50"
            cy="50"
            r={r}
            strokeWidth="10"
            strokeDashoffset="0"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${rotate.primary[arcPriority][size]} origin-center`}
            stroke={primary}
            strokeDasharray={`${
              arcPriority === "default"
                ? (circumference * value) / 100
                : (circumference * (100 - 2 * gapPercent[size])) / 100 / 2
            } ${circumference}`}
          />
        )}
      </svg>
      {showValue && size !== "tiny" && !indeterminate && (
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <p
            className={`text-gray-1000 font-sans ${
              {
                small: "text-[11px] font-medium",
                medium: "text-[18px] font-medium",
                large: "text-[32px] font-semibold",
              }[size]
            }`}
          >
            {value}
          </p>
        </div>
      )}
      {indeterminate && (
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <svg
            height={sizes[size] / 2}
            width={sizes[size] / 2}
            viewBox="0 0 16 16"
            strokeLinejoin="round"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5.51324 3.62367L3.76375 8.34731C3.61845 8.7396 3.24433 8.99999 2.826 8.99999H0.75H0V7.49999H0.75H2.47799L4.56666 1.86057C4.88684 0.996097 6.10683 0.988493 6.43776 1.84891L10.5137 12.4463L12.2408 8.1286C12.3926 7.74894 12.7604 7.49999 13.1693 7.49999H15.25H16V8.99999H15.25H13.5078L11.433 14.1868C11.0954 15.031 9.8976 15.023 9.57122 14.1744L5.51324 3.62367Z"
              fill="#a1a1a1"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
