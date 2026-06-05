"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type Screen =
  | "login"
  | "dashboard"
  | "subjects"
  | "ai-analysis"
  | "weak-topics"
  | "study-plan"
  | "recommendations"
  | "ai-mentor"
  | "deadlines"
  | "calendar"
  | "analytics"
  | "notifications"
  | "materials"
  | "profile"
  | "settings"

interface NavigationContextType {
  currentScreen: Screen
  setScreen: (screen: Screen) => void
  isLoggedIn: boolean
  setIsLoggedIn: (v: boolean) => void
}

const NavigationContext = createContext<NavigationContextType | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [currentScreen, setScreen] = useState<Screen>("login")
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  return (
    <NavigationContext.Provider value={{ currentScreen, setScreen, isLoggedIn, setIsLoggedIn }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider")
  return ctx
}
