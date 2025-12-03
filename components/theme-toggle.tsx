"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { getTheme, saveTheme } from "@/lib/storage"

export function ThemeToggle() {
  const [theme, setTheme] = useState("dark")

  useEffect(() => {
    const savedTheme = getTheme()
    setTheme(savedTheme)
    document.documentElement.classList.toggle("light", savedTheme === "light")
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    saveTheme(newTheme)
    document.documentElement.classList.toggle("light", newTheme === "light")
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme}>
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}
