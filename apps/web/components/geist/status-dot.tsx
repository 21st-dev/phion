import React from "react";

const states = {
  QUEUED: "bg-accents-2",
  BUILDING: "bg-warning",
  ERROR: "bg-error",
  READY: "bg-cyan",
  CANCELED: "bg-accents-2",
};

const titles = {
  QUEUED: "This deployment is queued.",
  BUILDING: "This deployment is building.",
  ERROR: "This deployment had an error.",
  READY: "This deployment is ready.",
  CANCELED: "This deployment was canceled.",
};

interface StatusDotProps {
  state: keyof typeof states;
  label?: boolean;
}

export const StatusDot = ({ state, label }: StatusDotProps) => {
  return (
    <span
      aria-label={titles[state]}
      className="inline-flex items-center gap-2"
      title={titles[state]}
    >
      <span
        className={`inline-block w-2.5 h-2.5 rounded-[5px] ${states[state]}`}
      />
      {label && (
        <span className="font-sans text-[14px] leading-4 text-gray-1000 capitalize">
          {state.toLowerCase()}
        </span>
      )}
    </span>
  );
};
