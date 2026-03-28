// ── IPC Channel Names ───────────────────────────────────────────────

export const IPC_CHANNELS = {
  // Main → Renderer (push updates)
  STATE_UPDATE: 'state:update',
  PROJECTS_UPDATE: 'projects:update',
  PORTS_UPDATE: 'ports:update',
  HEALTH_UPDATE: 'health:update',
  CONFLICTS_UPDATE: 'conflicts:update',

  // Renderer → Main (requests)
  GET_STATE: 'state:get',
  GET_PROJECTS: 'projects:get',
  GET_CONFIG: 'config:get',
  SAVE_CONFIG: 'config:save',

  // Quick actions
  OPEN_TERMINAL: 'action:open-terminal',
  OPEN_EDITOR: 'action:open-editor',
  OPEN_GIT_GUI: 'action:open-git-gui',
  KILL_PORT: 'action:kill-port',

  // Window management
  OPEN_DASHBOARD: 'window:open-dashboard',
  CLOSE_WINDOW: 'window:close'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
