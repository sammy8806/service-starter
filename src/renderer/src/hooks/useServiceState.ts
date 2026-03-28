import { useMemo } from 'react'
import { useAppState } from '../context/AppContext'

export interface ProjectSummary {
  name: string
  directory: string
  isRunning: boolean
  hasWarning: boolean
  componentCount: number
  runningComponentCount: number
}

export interface ComponentSummary {
  name: string
  projectName: string
  projectDir: string
  status: 'running' | 'stopped' | 'warning'
  ports: { port: number; label: string; status: string }[]
  workDir?: string
  codeDir?: string
}

/**
 * Hook for consuming app state with derived summaries.
 */
export function useServiceState() {
  const { state, openTerminal, openEditor, openGitGui, killPort, openDashboard } = useAppState()

  const projectSummaries = useMemo((): ProjectSummary[] => {
    return Object.values(state.projects).map((project) => {
      const components = Object.values(project.components)
      const runningCount = components.filter((c) => c.status === 'running').length
      const hasWarning = components.some((c) => c.status === 'warning')

      return {
        name: project.name,
        directory: project.directory,
        isRunning: runningCount > 0,
        hasWarning,
        componentCount: components.length,
        runningComponentCount: runningCount
      }
    })
  }, [state.projects])

  const totalConflicts = state.conflicts.length
  const hasConflicts = totalConflicts > 0

  return {
    state,
    projectSummaries,
    totalConflicts,
    hasConflicts,
    openTerminal,
    openEditor,
    openGitGui,
    killPort,
    openDashboard
  }
}
