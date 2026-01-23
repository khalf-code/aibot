import React, { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { AppProvider } from './src/contexts/AppContext'
import { Session } from './src/models/types'
import SessionListView from './src/views/SessionListView'
import ChatView from './src/views/ChatView'
import SettingsView from './src/views/SettingsView'

type ViewType = 'list' | 'chat' | 'settings'

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('list')
  const [activeSession, setActiveSession] = useState<Session | null>(null)

  const handleSessionPress = (session: Session) => {
    setActiveSession(session)
    setCurrentView('chat')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setActiveSession(null)
  }

  const handleSettingsPress = () => {
    setCurrentView('settings')
  }

  return (
    <AppProvider>
      <StatusBar style="light" />
      {currentView === 'list' ? (
        <SessionListView onSessionPress={handleSessionPress} onSettingsPress={handleSettingsPress} />
      ) : currentView === 'settings' ? (
        <SettingsView onBack={handleBackToList} />
      ) : activeSession ? (
        <ChatView session={activeSession} onBack={handleBackToList} />
      ) : null}
    </AppProvider>
  )
}
