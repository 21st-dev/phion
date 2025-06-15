import React from "react";
import { Spinner } from "./spinner";
import { cn } from "@/lib/utils";

const sizes = [
  {
    tiny: "px-1.5 h-6 text-sm",
    small: "px-1.5 h-8 text-sm",
    medium: "px-2.5 h-10 text-sm",
    large: "px-3.5 h-12 text-base",
  },
  {
    tiny: "w-6 h-6 text-sm",
    small: "w-8 h-8 text-sm",
    medium: "w-10 h-10 text-sm",
    large: "w-12 h-12 text-base",
  },
];

const types = {
  primary:
    "bg-[#171717] dark:bg-[#ededed] hover:bg-[#383838] dark:hover:bg-[#cccccc] text-white dark:text-[#0a0a0a] fill-white dark:fill-[#0a0a0a]",
  secondary:
    "bg-white dark:bg-[#171717] hover:bg-[#00000014] dark:hover:bg-[#ffffff17] text-[#171717] dark:text-[#ededed] fill-[#171717] dark:fill-[#ededed] border border-[#00000014] dark:border-[#ffffff24]",
  tertiary:
    "bg-white dark:bg-[#171717] hover:bg-[#00000014] dark:hover:bg-[#ffffff17] text-[#171717] dark:text-[#ededed] fill-[#171717] dark:fill-[#ededed]",
  error:
    "bg-[#ea001d] dark:bg-[#e2162a] hover:bg-[#ae292f] dark:hover:bg-[#ff565f] text-[#f5f5f5] dark:text-white fill-[#f5f5f5] dark:fill-white",
  warning: "bg-[#ff9300] hover:bg-[#d27504] text-[#0a0a0a] fill-[#0a0a0a]",
};

const shapes = {
  square: {
    tiny: "rounded",
    small: "rounded-md",
    medium: "rounded-md",
    large: "rounded-lg",
  },
  circle: {
    tiny: "rounded-[100%]",
    small: "rounded-[100%]",
    medium: "rounded-[100%]",
    large: "rounded-[100%]",
  },
  rounded: {
    tiny: "rounded-[100px]",
    small: "rounded-[100px]",
    medium: "rounded-[100px]",
    large: "rounded-[100px]",
  },
};

export interface ButtonProps {
  size?: keyof (typeof sizes)[0];
  type?: keyof typeof types;
  shape?: keyof typeof shapes;
  svgOnly?: boolean;
  children?: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  shadow?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      size = "medium",
      type = "primary",
      shape = "square",
      svgOnly = false,
      children,
      prefix,
      suffix,
      shadow = false,
      loading = false,
      disabled = false,
      fullWidth = false,
      onClick,
      className,
      ...rest
    },
    ref,
  ) => {
    // Icon size for prefix/suffix
    const iconSize =
      size === "large" ? 24 : size === "small" || size === "tiny" ? 16 : 20;

    return (
      <button
        ref={ref}
        type="submit"
        disabled={disabled}
        onClick={onClick}
        tabIndex={0}
        className={cn(
          "flex justify-center items-center gap-2 duration-150",
          sizes[+svgOnly][size],
          disabled || loading
            ? "bg-[#f2f2f2] dark:bg-[#1a1a1a] text-[#8f8f8f] fill-[#8f8f8f] border border-[#ebebeb] dark:border-[#2e2e2e] cursor-not-allowed"
            : types[type],
          shapes[shape][size],
          shadow &&
            "shadow-[0_0_0_1px_#00000014,_0px_2px_2px_#0000000a] border-none",
          fullWidth && "w-full",
          "focus:shadow-[0_0_0_2px_hsla(0,0%,100%,1),0_0_0_4px_oklch(57.61% 0.2508 258.23)]",
          className,
        )}
        {...rest}
      >
        {/* Prefix/Icon */}
        {loading ? (
          <Spinner size={iconSize} />
        ) : prefix ? (
          <span className="flex items-center justify-center mr-2">
            {React.isValidElement(prefix)
              ? React.cloneElement(prefix as React.ReactElement, {
                  width: iconSize,
                  height: iconSize,
                  className: cn(
                    "inline-block align-middle",
                    prefix.props?.className,
                  ),
                })
              : prefix}
          </span>
        ) : null}

        {/* Button label */}
        {children && (
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap overflow-ellipsis font-sans",
              size !== "tiny" && "px-1.5",
            )}
          >
            {children}
          </span>
        )}

        {/* Suffix/Icon */}
        {!loading && suffix ? (
          <span className="flex items-center justify-center ml-2">
            {React.isValidElement(suffix)
              ? React.cloneElement(suffix as React.ReactElement, {
                  width: iconSize,
                  height: iconSize,
                  className: cn(
                    "inline-block align-middle",
                    suffix.props?.className,
                  ),
                })
              : suffix}
          </span>
        ) : null}
      </button>
    );
  },
);

Button.displayName = "Button";
