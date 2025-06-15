import React, { useEffect, useState } from "react"
import { ContextCard } from "./context-card"

interface RelativeTimeCardProps {
  children: React.ReactNode
  date: number
  side?: "top" | "bottom" | "left" | "right"
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp)

  const optionsDate: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  }
  const optionsTime: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }

  const utcDate = date.toLocaleDateString("en-US", {
    ...optionsDate,
    timeZone: "UTC",
  })
  const utcTime = date.toLocaleTimeString("en-US", {
    ...optionsTime,
    timeZone: "UTC",
  })

  const localDate = date.toLocaleDateString("en-US", optionsDate)
  const localTime = date.toLocaleTimeString("en-US", optionsTime)

  const timezoneOffset = (() => {
    const offset = -date.getTimezoneOffset() / 60
    const sign = offset >= 0 ? "+" : "-"
    return `GMT${sign}${Math.abs(offset)}`
  })()

  return { utcDate, utcTime, localDate, localTime, timezoneOffset }
}

const useTimeAgo = (timestamp: number) => {
  const getTimeAgo = () => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - timestamp) / 1000)

    const years = Math.floor(diff / (60 * 60 * 24 * 365))
    const months = Math.floor((diff % (60 * 60 * 24 * 365)) / (60 * 60 * 24 * 30))
    const days = Math.floor((diff % (60 * 60 * 24 * 30)) / (60 * 60 * 24))
    const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60))
    const minutes = Math.floor((diff % (60 * 60)) / 60)
    const seconds = diff % 60

    if (diff < 1) return "just now"
    if (years > 0)
      return `${years} year${years > 1 ? "s" : ""}${
        months > 0 ? `, ${months} month${months > 1 ? "s" : ""} ` : ""
      }${days > 0 ? `, ${days} day${days > 1 ? "s" : ""} ` : ""}ago`
    if (months > 0)
      return `${months} month${months > 1 ? "s" : ""}${
        days > 0 ? `, ${days} day${days > 1 ? "s" : ""} ` : ""
      }ago`
    if (days > 0)
      return `${days} day${days > 1 ? "s" : ""}${
        hours > 0 ? `, ${hours} hour${hours > 1 ? "s" : ""} ` : ""
      }ago`
    if (hours > 0)
      return `${hours} hour${hours > 1 ? "s" : ""}${
        minutes > 0 ? `, ${minutes} minute${minutes > 1 ? "s" : ""} ` : ""
      }ago`
    if (minutes > 0)
      return `${minutes} minute${minutes > 1 ? "s" : ""}${
        seconds > 0 ? `, ${seconds} second${seconds > 1 ? "s" : ""} ` : ""
      }ago`
    return `${seconds} second${seconds > 1 ? "s" : ""} ago`
  }

  const [timeAgo, setTimeAgo] = useState(getTimeAgo())

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo())
    }, 1000)

    return () => clearInterval(interval)
  }, [timestamp])

  return timeAgo
}

const Content = ({ date }: { date: number }) => {
  const { utcDate, utcTime, localDate, localTime, timezoneOffset } = formatTimestamp(date)
  const timeAgo = useTimeAgo(date)

  return (
    <div className="font-sans text-xs w-80">
      <div className="text-start">{timeAgo}</div>
      <div className="flex justify-between items-center mt-3">
        <div className="flex gap-2">
          <div className="px-2 rounded bg-muted-foreground/50">UTC</div>
          <div>{utcDate}</div>
        </div>
        <div className="font-mono">{utcTime}</div>
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="flex gap-2">
          <div className="px-2 rounded bg-muted-foreground/50">{timezoneOffset}</div>
          <div>{localDate}</div>
        </div>
        <div className="font-mono">{localTime}</div>
      </div>
    </div>
  )
}

export const RelativeTimeCard = ({ children, date, side = "top" }: RelativeTimeCardProps) => {
  return (
    <ContextCard.Trigger content={<Content date={date} />} side={side}>
      {children}
    </ContextCard.Trigger>
  )
}
