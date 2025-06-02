import React from "react";

const sizes = [
  {
    xsmall: "h-6 text-xs pl-1.5 pr-[22px]",
    small: "h-8 text-sm pl-3 pr-9",
    medium: "h-10 text-sm pl-3 pr-9",
    large: "h-12 text-base pl-3 pr-9 rounded-lg"
  },
  {
    xsmall: "h-6 text-xs px-[22px]",
    small: "h-8 text-sm px-9",
    medium: "h-10 text-sm px-9",
    large: "h-12 text-base px-9 rounded-lg"
  }
];

export interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options?: Option[];
  label?: string;
  value?: string;
  placeholder?: string;
  size?: keyof typeof sizes[0];
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  disabled?: boolean;
  error?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}

const ArrowBottom = () => (
  <svg
    height="16"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="16"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14.0607 5.49999L13.5303 6.03032L8.7071 10.8535C8.31658 11.2441 7.68341 11.2441 7.29289 10.8535L2.46966 6.03032L1.93933 5.49999L2.99999 4.43933L3.53032 4.96966L7.99999 9.43933L12.4697 4.96966L13 4.43933L14.0607 5.49999Z"
    />
  </svg>
);

const Error = () => (
  <svg
    height="16"
    strokeLinejoin="round"
    viewBox="0 0 16 16"
    width="16"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.30761 1.5L1.5 5.30761L1.5 10.6924L5.30761 14.5H10.6924L14.5 10.6924V5.30761L10.6924 1.5H5.30761ZM5.10051 0C4.83529 0 4.58094 0.105357 4.3934 0.292893L0.292893 4.3934C0.105357 4.58094 0 4.83529 0 5.10051V10.8995C0 11.1647 0.105357 11.4191 0.292894 11.6066L4.3934 15.7071C4.58094 15.8946 4.83529 16 5.10051 16H10.8995C11.1647 16 11.4191 15.8946 11.6066 15.7071L15.7071 11.6066C15.8946 11.4191 16 11.1647 16 10.8995V5.10051C16 4.83529 15.8946 4.58093 15.7071 4.3934L11.6066 0.292893C11.4191 0.105357 11.1647 0 10.8995 0H5.10051ZM8.75 3.75V4.5V8L8.75 8.75H7.25V8V4.5V3.75H8.75ZM8 12C8.55229 12 9 11.5523 9 11C9 10.4477 8.55229 10 8 10C7.44772 10 7 10.4477 7 11C7 11.5523 7.44772 12 8 12Z"
    />
  </svg>
);

export const Select = ({
  options,
  label,
  value,
  placeholder,
  size = "medium",
  suffix,
  prefix,
  disabled = false,
  error,
  onChange
}: SelectProps) => {
  return (
    <div>
      {label && (
        <label
          htmlFor="select"
          className="cursor-text block font-sans text-[13px] text-[#666666] dark:text-[#a1a1a1] capitalize mb-2"
        >
          {label}
        </label>
      )}
      <div
        className={`relative flex items-center ${disabled ? "fill-[#8f8f8f]" : "fill-[#666666] dark:fill-[#a1a1a1] hover:fill-[#171717] hover:dark:fill-[#ededed]"}`}>
        <style>
          {`
          .xsmallIconContainer svg {
              width: 16px;
              height: 12px;
          }
          .smallIconContainer, .mediumIconContainer, .largeIconContainer svg {
              width: 16px;
              height: 16px;
          }
        `}
        </style>
        <select
          id="select"
          disabled={disabled}
          value={value}
          onChange={onChange}
          className={`font-sans  appearance-none w-full border rounded-[5px] duration-200 outline-none ${sizes[prefix ? 1 : 0][size]} ${disabled ? "cursor-not-allowed bg-[#f2f2f2] dark:bg-[#1a1a1a] text-[#8f8f8f]" : "text-[#171717] dark:text-[#ededed] bg-white dark:bg-[#0a0a0a] cursor-pointer"} ${error ? "border-[#ee0000] dark:border-[#ff0000] ring-[#cb2a2f29] dark:ring-[#ff616629] ring-opacity-100 ring-[3px]" : "border-[#00000014] dark:border-[#ffffff24] ring-[#d7d7d7] dark:ring-[#555555] ring-opacity-100 focus:ring-[3px]"}`}
        >
          {placeholder && <option value="" disabled selected>{placeholder}</option>}
          {options && options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {prefix && (
          <span
            className={`inline-flex absolute ${size === "xsmall" ? "left-[5px]" : "left-3"} pointer-events-none duration-150 ${size}IconContainer`}>
            {prefix}
          </span>
        )}
        <span
          className={`inline-flex absolute ${size === "xsmall" ? "right-[5px]" : "right-3"} pointer-events-none duration-150 ${size}IconContainer`}>
          {suffix ? suffix : <ArrowBottom />}
        </span>
      </div>
      {error && (
        <div
          className={`mt-2 flex items-center gap-2 text-[#d8001b] dark:text-[#ff565f] fill-[#d8001b] dark:fill-[#ff565f] ${size === "large" ? "text-base" : "text-[13px]"}`}>
          <Error />
          {error}
        </div>
      )}
    </div>
  );
}; 