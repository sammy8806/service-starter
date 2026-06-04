import { useState, useEffect } from 'react'

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

const SELECT_CLASS =
  'w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-[13px] text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors'

export function SettingsView(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsForm>(DEFAULTS)
  const [saved, setSaved] = useState<SettingsForm | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    window.api.getConfig().then((config) => {
      const normalized = normalize(config as Partial<SettingsForm>)
      setSettings(normalized)
      setSaved(normalized)
    })
  }, [])

  const dirty = saved !== null && JSON.stringify(settings) !== JSON.stringify(saved)

  const handleSave = async (): Promise<void> => {
    await window.api.saveConfig(settings)
    setSaved(settings)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
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
    <div className="p-6 max-w-2xl space-y-7 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
      <section>
        <h3 className="text-[13px] font-medium text-zinc-200 mb-1">Scan Directories</h3>
        <p className="text-[12px] text-zinc-500 mb-3">
          Directories scanned for projects with a{' '}
          <span className="font-mono text-zinc-400">.service-starter.yml</span> manifest.
        </p>
        <div className="space-y-1.5 mb-3">
          {settings.scanDirectories.map((dir) => (
            <div
              key={dir}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]"
            >
              <span className="flex-1 text-[13px] font-mono text-zinc-400 break-all">{dir}</span>
              <button
                onClick={() => removeDirectory(dir)}
                className="text-zinc-600 hover:text-red-400 transition-colors"
                aria-label={`Remove ${dir}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addDirectory}
          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-[13px] text-zinc-200 rounded-lg transition-colors"
        >
          Add directory…
        </button>
      </section>

      <section>
        <h3 className="text-[13px] font-medium text-zinc-200 mb-3">Scan Intervals</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Project scan (ms)</label>
            <input
              type="number"
              value={settings.scanIntervalMs}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  scanIntervalMs: parseInt(e.target.value) || DEFAULTS.scanIntervalMs
                })
              }
              className={SELECT_CLASS + ' font-mono'}
            />
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Port scan (ms)</label>
            <input
              type="number"
              value={settings.portScanIntervalMs}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  portScanIntervalMs: parseInt(e.target.value) || DEFAULTS.portScanIntervalMs
                })
              }
              className={SELECT_CLASS + ' font-mono'}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-medium text-zinc-200 mb-3">Applications</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Editor</label>
            <select
              value={settings.editor}
              onChange={(e) => setSettings({ ...settings, editor: e.target.value })}
              className={SELECT_CLASS}
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
            <label className="text-[12px] text-zinc-500 block mb-1">Terminal</label>
            <select
              value={settings.terminal}
              onChange={(e) => setSettings({ ...settings, terminal: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="default">Terminal.app</option>
              <option value="iterm">iTerm2</option>
              <option value="warp">Warp</option>
              <option value="alacritty">Alacritty</option>
              <option value="kitty">Kitty</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Git GUI</label>
            <select
              value={settings.gitGui}
              onChange={(e) => setSettings({ ...settings, gitGui: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="fork">Fork</option>
              <option value="gitkraken">GitKraken</option>
              <option value="sourcetree">Sourcetree</option>
              <option value="github-desktop">GitHub Desktop</option>
              <option value="tower">Tower</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            dirty ? 'bg-zinc-100 text-zinc-900 hover:bg-white' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          Save Settings
        </button>
        {savedFlash && <span className="text-[12px] text-emerald-400">Saved</span>}
      </div>
    </div>
  )
}
