"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Toggle } from "@/components/geist/toggle";
import { Tooltip } from "@/components/geist/tooltip";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className: _className }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <Tooltip
      text={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      <Toggle
        checked={resolvedTheme === "dark"}
        onChange={toggleTheme}
        size="small"
        icon={{
          checked: <Moon className="h-3 w-3" />,
          unchecked: <Sun className="h-3 w-3" />,
        }}
      />
    </Tooltip>
  );
}
