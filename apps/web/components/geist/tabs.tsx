import React from "react";
import { Tooltip } from "./tooltip";

type TTabVariant = "primary" | "secondary";

export interface ITab {
  title?: string;
  value: string;
  disabled?: boolean;
  icon?: string;
  tooltip?: string;
}

interface TabsProps {
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
  tabs: ITab[];
  disabled?: boolean;
  variant?: TTabVariant;
}

interface TabProps extends ITab {
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
  variant: TTabVariant;
}

const getClasses = (
  isSelected: boolean,
  disabled: boolean,
  variant: TTabVariant
) => {
  let classes = `relative overflow-visible box-border font-sans text-sm flex gap-0.5 duration-100 ${
    disabled ? "cursor-not-allowed" : "cursor-pointer"
  }`;
  if (isSelected) {
    if (variant === "primary") {
      classes += " border-b-2 border-gray-1000 -mb-0.5";
    } else if (variant === "secondary") {
      classes += " bg-gray-1000";
    }
  } else {
    if (variant === "secondary") {
      if (disabled) {
        classes += " bg-gray-200";
      } else {
        classes += " bg-gray-alpha-200";
      }
    }
  }
  if (variant === "primary") {
    classes += " pb-[5px] hover:text-gray-1000";
  } else if (variant === "secondary") {
    classes += " h-6 rounded-md text-[13px] px-1.5 items-center";
  }
  if (disabled) {
    classes += isSelected ? " text-gray-1000" : " text-gray-900";
  } else {
    if (variant === "primary") {
      classes += isSelected ? " text-gray-1000" : " text-gray-900";
    } else {
      classes += isSelected ? " text-background-100" : " text-gray-1000";
    }
  }

  return classes;
};

const Tab = ({
  selected,
  setSelected,
  title,
  value,
  disabled = false,
  icon,
  variant,
}: TabProps) => {
  if (!title && !icon) {
    return null;
  }

  return (
    <div
      className={getClasses(selected === value, disabled, variant)}
      onClick={() => {
        if (!disabled) {
          setSelected(value);
        }
      }}
    >
      {icon && <img src={icon} alt={title} width={16} height={16} />}
      <div>{title}</div>
    </div>
  );
};

export const Tabs = ({
  selected,
  setSelected,
  tabs,
  disabled = false,
  variant = "primary",
}: TabsProps) => {
  return (
    <div
      className={`flex${disabled ? " cursor-not-allowed" : ""} ${
        variant === "primary"
          ? "gap-6 pb-[1px] border-b border-accents-2"
          : "gap-2"
      }`}
    >
      {tabs.map((tab) =>
        tab.tooltip ? (
          <Tooltip key={tab.value} text={tab.tooltip}>
            <Tab
              selected={selected}
              setSelected={setSelected}
              disabled={disabled || tab.disabled}
              variant={variant}
              {...tab}
            />
          </Tooltip>
        ) : (
          <Tab
            key={tab.value}
            selected={selected}
            setSelected={setSelected}
            disabled={disabled || tab.disabled}
            variant={variant}
            {...tab}
          />
        )
      )}
    </div>
  );
};
