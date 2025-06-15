import React from "react"

interface PaginationItem {
  title: string
  href: string
}

interface PaginationProps {
  next?: PaginationItem
  previous?: PaginationItem
  children?: React.ReactNode
}

const ArrowLeftIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className="h-5 w-5">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.5 14.0607L9.96966 13.5303L5.14644 8.7071C4.75592 8.31658 4.75592 7.68341 5.14644 7.29289L9.96966 2.46966L10.5 1.93933L11.5607 2.99999L11.0303 3.53032L6.56065 7.99999L11.0303 12.4697L11.5607 13L10.5 14.0607Z"
    />
  </svg>
)

const ArrowRightIcon = () => (
  <svg height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" className="w-5 h-5">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.50001 1.93933L6.03034 2.46966L10.8536 7.29288C11.2441 7.68341 11.2441 8.31657 10.8536 8.7071L6.03034 13.5303L5.50001 14.0607L4.43935 13L4.96968 12.4697L9.43935 7.99999L4.96968 3.53032L4.43935 2.99999L5.50001 1.93933Z"
    />
  </svg>
)

export const Pagination = ({ next, previous, children }: PaginationProps) => {
  return (
    <nav aria-label="pagination" className="flex justify-between items-center gap-1">
      {previous && (
        <a
          href={previous.href}
          className="rounded-md py-1 pr-2 pl-7 !no-underline font-sans text-gray-900 hover:text-gray-1000 fill-gray-900 hover:fill-gray-1000 duration-150"
        >
          <span className="text-[0.8125rem] leading-[1.125rem] mb-0.5">Previous</span>
          <div className="relative">
            <span className="text-gray-1000 text-base font-medium">{previous.title}</span>
            <span className="absolute -left-[26px] mt-0.5">
              <ArrowLeftIcon />
            </span>
          </div>
        </a>
      )}
      {children && <div>{children}</div>}
      {next && (
        <a
          href={next.href}
          className="rounded-md ml-auto py-1 pl-2 pr-7 !no-underline font-sans text-gray-900 hover:text-gray-1000 fill-gray-900 hover:fill-gray-1000 duration-150"
        >
          <span className="text-[0.8125rem] leading-[1.125rem] mb-0.5">Next</span>
          <div className="relative">
            <span className="text-gray-1000 text-base font-medium">{next.title}</span>
            <span className="absolute -right-[26px] mt-0.5">
              <ArrowRightIcon />
            </span>
          </div>
        </a>
      )}
    </nav>
  )
}
