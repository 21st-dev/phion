"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ThemeToggleProps {
  fillIcon?: boolean;
}

export function ThemeToggle({ fillIcon = true }: ThemeToggleProps) {
  const [theme, setTheme] = React.useState(() => {
    // Check if dark mode is already enabled
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    }
    return "light";
  });

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Store preference in localStorage
    localStorage.setItem("theme", newTheme);
  };

  React.useEffect(() => {
    // Apply stored theme on component mount
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme && storedTheme !== theme) {
      setTheme(storedTheme);
      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          className="group bg-transparent data-[state=on]:!bg-transparent hover:bg-accent hover:!text-foreground"
          pressed={theme === "dark"}
          onPressedChange={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          size="sm"
        >
          {theme === "dark" ? (
            <Sun
              size={18}
              strokeWidth={2}
              className={`shrink-0 ${fillIcon ? "fill-current" : ""}`}
              aria-hidden="true"
            />
          ) : (
            <Moon
              size={18}
              strokeWidth={2}
              className={`shrink-0 ${fillIcon ? "fill-current" : ""}`}
              aria-hidden="true"
            />
          )}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent className="z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
        <p className="flex items-center gap-1.5">
          {theme === "dark" ? "Light" : "Dark"} mode
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
