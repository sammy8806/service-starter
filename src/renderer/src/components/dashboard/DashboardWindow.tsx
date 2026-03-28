import { useState } from 'react'
import { ProjectsTab } from './ProjectsTab'
import { PortMapTab } from './PortMapTab'
import { DependenciesTab } from './DependenciesTab'
import { SettingsTab } from './SettingsTab'

type Tab = 'projects' | 'ports' | 'dependencies' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'projects', label: 'Projects' },
  { id: 'ports', label: 'Port Map' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'settings', label: 'Settings' }
]

export function DashboardWindow(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('projects')

  return (
    <div className="h-screen flex flex-col bg-zinc-900 text-zinc-100">
      {/* Title bar / drag region */}
      <div
        className="flex items-center justify-between pl-20 pr-5 pt-3 pb-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="text-base font-semibold tracking-tight text-zinc-200">
          Service Starter
        </h1>
      </div>

      {/* Tab bar */}
      <nav className="flex gap-0 px-5 mt-3 border-b border-white/[0.06]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-[13px] font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-zinc-100 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'projects' && <ProjectsTab />}
        {activeTab === 'ports' && <PortMapTab />}
        {activeTab === 'dependencies' && <DependenciesTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
