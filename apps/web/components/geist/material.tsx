import React, { forwardRef } from "react";

const types = {
  base: "rounded-md shadow-border",
  small: "rounded-md shadow-border-small",
  medium: "rounded-xl shadow-border-medium",
  large: "rounded-xl shadow-border-large",
  tooltip: "rounded-md shadow-tooltip",
  menu: "rounded-xl shadow-menu",
  modal: "rounded-xl shadow-modal",
  fullscreen: "rounded-2xl shadow-fullscreen",
};

interface MaterialProps {
  type: keyof typeof types;
  children: React.ReactNode;
  className?: string;
}

export const Material = forwardRef<HTMLDivElement, MaterialProps>(
  ({ type, children, className }, ref) => {
    return (
      <div
        className={`bg-background-100 ${types[type]}${
          className ? ` ${className}` : ""
        }`}
        ref={ref}
      >
        {children}
      </div>
    );
  }
);

Material.displayName = "Material";
