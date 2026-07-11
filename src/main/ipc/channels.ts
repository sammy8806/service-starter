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

  // Process management
  START_COMPONENT: 'process:start-component',
  STOP_COMPONENT: 'process:stop-component',
  START_PROJECT: 'process:start-project',
  STOP_PROJECT: 'process:stop-project',

  // Log streaming
  LOG_GET: 'log:get',
  LOG_START_TAIL: 'log:start-tail',
  LOG_STOP_TAIL: 'log:stop-tail',
  LOG_DATA: 'log:data',

  // Window management
  OPEN_DASHBOARD: 'window:open-dashboard',
  CLOSE_WINDOW: 'window:close',
  RESIZE_WINDOW: 'window:resize',

  // Favorites
  FAVORITES_GET: 'favorites:get',
  FAVORITES_TOGGLE: 'favorites:toggle',

  // Service actions (context menu + buttons)
  RESTART_COMPONENT: 'process:restart-component',
  STOP_ALL_MANAGED: 'process:stop-all-managed',
  COPY_TO_CLIPBOARD: 'action:copy',
  EDIT_MANIFEST: 'action:edit-manifest',
  SHOW_PROCESS_INFO: 'action:show-process-info',
  TAIL_LOGS: 'log:tail-open',
  SHOW_CONTEXT_MENU: 'menu:show',

  // Dashboard
  DIALOG_SELECT_DIRECTORY: 'dialog:select-directory',
  COMPONENT_GET_ENV: 'component:get-env',

  // Docker container control
  DOCKER_START: 'docker:start-container',
  DOCKER_STOP: 'docker:stop-container',
  DOCKER_START_ID: 'docker:start-container-id',
  DOCKER_STOP_ID: 'docker:stop-container-id'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
