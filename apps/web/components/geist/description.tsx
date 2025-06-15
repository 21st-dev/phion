import React from "react"

interface DescriptionProps {
  title: string
  content: string
  tooltip?: string
}

const DescriptionIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className="w-3.5 h-3.5">
    <path
      d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z"
      fillOpacity="0.08"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 6C8.55228 6 9 5.55228 9 5C9 4.44772 8.55228 4 8 4C7.44771 4 7 4.44772 7 5C7 5.55228 7.44771 6 8 6ZM7 7H6.25V8.5H7H7.24999V10.5V11.25H8.74999V10.5V8C8.74999 7.44772 8.30227 7 7.74999 7H7Z"
    />
  </svg>
)

export const Description = ({ title, content, tooltip }: DescriptionProps) => {
  return (
    <dl className="font-sans">
      <dt className="text-sm text-gray-900 capitalize flex items-center gap-1">
        {title}
        {tooltip && (
          <span title={tooltip} className="cursor-help">
            <DescriptionIcon />
          </span>
        )}
      </dt>
      <dd className="text-sm text-gray-1000 font-medium mt-1">{content}</dd>
    </dl>
  )
}
