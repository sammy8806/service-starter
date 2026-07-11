import { useState, useEffect, useRef } from 'react'
import { Section } from './ui/Section'
import { ActionButton } from './ui/ActionButton'

interface SettingsForm {
  scanDirectories: string[]
  scanIntervalMs: number
  portScanIntervalMs: number
  editor: string
  terminal: string
  gitGui: string
}

const DEFAULTS: SettingsForm = {
  scanDirectories: [],
  scanIntervalMs: 5000,
  portScanIntervalMs: 3000,
  editor: 'code',
  terminal: 'default',
  gitGui: 'fork'
}

function normalize(config: Partial<SettingsForm>): SettingsForm {
  return {
    scanDirectories: config.scanDirectories ?? [],
    scanIntervalMs: config.scanIntervalMs ?? DEFAULTS.scanIntervalMs,
    portScanIntervalMs: config.portScanIntervalMs ?? DEFAULTS.portScanIntervalMs,
    editor: config.editor ?? DEFAULTS.editor,
    terminal: config.terminal ?? DEFAULTS.terminal,
    gitGui: config.gitGui ?? DEFAULTS.gitGui
  }
}

const INPUT_CLASS =
  'w-full rounded-lg border border-white/[0.08] bg-zinc-800 px-3 py-2 text-[13px] text-zinc-300 transition-colors focus:border-zinc-500 focus:outline-none'

export function SettingsView(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsForm>(DEFAULTS)
  const [saved, setSaved] = useState<SettingsForm | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [rawConfig, setRawConfig] = useState<Record<string, unknown>>({})
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.getConfig().then((config) => {
      const normalized = normalize(config as Partial<SettingsForm>)
      setSettings(normalized)
      setSaved(normalized)
      setRawConfig((config as Record<string, unknown>) ?? {})
    })
  }, [])

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    }
  }, [])

  const dirty = saved !== null && JSON.stringify(settings) !== JSON.stringify(saved)

  const handleSave = async (): Promise<void> => {
    await window.api.saveConfig({ ...rawConfig, ...settings })
    setSaved(settings)
    setSavedFlash(true)
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2000)
  }

  const addDirectory = async (): Promise<void> => {
    const dir = await window.api.selectDirectory()
    if (dir && !settings.scanDirectories.includes(dir)) {
      setSettings({ ...settings, scanDirectories: [...settings.scanDirectories, dir] })
    }
  }

  const removeDirectory = (dir: string): void => {
    setSettings({ ...settings, scanDirectories: settings.scanDirectories.filter((d) => d !== dir) })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
        <h2 className="text-[15px] font-semibold text-zinc-100">Settings</h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">Scan paths, intervals, and external applications</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto grid max-w-4xl gap-8">
          <Section title="Scan Directories">
            <p className="mb-3 text-[12px] text-zinc-500">
              Directories scanned for projects with a{' '}
              <span className="font-mono text-zinc-400">.service-starter.yml</span> manifest.
            </p>
            <div className="mb-3 space-y-1.5">
              {settings.scanDirectories.map((dir) => (
                <div
                  key={dir}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-800/50 px-3 py-2"
                >
                  <span className="flex-1 break-all font-mono text-[13px] text-zinc-400">{dir}</span>
                  <button
                    onClick={() => removeDirectory(dir)}
                    className="text-zinc-600 transition-colors hover:text-red-400"
                    aria-label={`Remove ${dir}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {settings.scanDirectories.length === 0 && (
                <p className="py-2 text-[12px] text-zinc-600">No directories configured yet.</p>
              )}
            </div>
            <ActionButton onClick={addDirectory}>Add directory…</ActionButton>
          </Section>

          <Section title="Scan Intervals">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="setting-scan-interval" className="mb-1 block text-[12px] text-zinc-500">
                  Project scan (ms)
                </label>
                <input
                  id="setting-scan-interval"
                  type="number"
                  value={settings.scanIntervalMs}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scanIntervalMs: parseInt(e.target.value, 10) || DEFAULTS.scanIntervalMs
                    })
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="setting-port-scan-interval" className="mb-1 block text-[12px] text-zinc-500">
                  Port scan (ms)
                </label>
                <input
                  id="setting-port-scan-interval"
                  type="number"
                  value={settings.portScanIntervalMs}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      portScanIntervalMs: parseInt(e.target.value, 10) || DEFAULTS.portScanIntervalMs
                    })
                  }
                  className={`${INPUT_CLASS} font-mono`}
                />
              </div>
            </div>
          </Section>

          <Section title="Applications">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="setting-editor" className="mb-1 block text-[12px] text-zinc-500">
                  Editor
                </label>
                <select
                  id="setting-editor"
                  value={settings.editor}
                  onChange={(e) => setSettings({ ...settings, editor: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="code">VS Code</option>
                  <option value="cursor">Cursor</option>
                  <option value="zed">Zed</option>
                  <option value="idea">IntelliJ IDEA</option>
                  <option value="webstorm">WebStorm</option>
                  <option value="sublime">Sublime Text</option>
                </select>
              </div>
              <div>
                <label htmlFor="setting-terminal" className="mb-1 block text-[12px] text-zinc-500">
                  Terminal
                </label>
                <select
                  id="setting-terminal"
                  value={settings.terminal}
                  onChange={(e) => setSettings({ ...settings, terminal: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="default">Terminal.app</option>
                  <option value="iterm">iTerm2</option>
                  <option value="warp">Warp</option>
                  <option value="alacritty">Alacritty</option>
                  <option value="kitty">Kitty</option>
                </select>
              </div>
              <div>
                <label htmlFor="setting-git-gui" className="mb-1 block text-[12px] text-zinc-500">
                  Git GUI
                </label>
                <select
                  id="setting-git-gui"
                  value={settings.gitGui}
                  onChange={(e) => setSettings({ ...settings, gitGui: e.target.value })}
                  className={INPUT_CLASS}
                >
                  <option value="fork">Fork</option>
                  <option value="gitkraken">GitKraken</option>
                  <option value="sourcetree">Sourcetree</option>
                  <option value="github-desktop">GitHub Desktop</option>
                  <option value="tower">Tower</option>
                </select>
              </div>
            </div>
          </Section>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-white/[0.06] px-6 py-3">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
            dirty
              ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
              : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
          }`}
        >
          Save Settings
        </button>
        {savedFlash && <span className="text-[12px] text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}
