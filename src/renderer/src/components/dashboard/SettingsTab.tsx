import { useState, useEffect } from 'react'

interface SettingsForm {
  scanDirectories: string[]
  scanIntervalMs: number
  portScanIntervalMs: number
  editor: string
  terminal: string
}

export function SettingsTab(): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsForm>({
    scanDirectories: [],
    scanIntervalMs: 5000,
    portScanIntervalMs: 3000,
    editor: 'code',
    terminal: 'default'
  })
  const [saved, setSaved] = useState(false)
  const [newDir, setNewDir] = useState('')

  useEffect(() => {
    window.api.getConfig().then((config) => {
      const c = config as SettingsForm
      setSettings({
        scanDirectories: c.scanDirectories ?? [],
        scanIntervalMs: c.scanIntervalMs ?? 5000,
        portScanIntervalMs: c.portScanIntervalMs ?? 3000,
        editor: c.editor ?? 'code',
        terminal: c.terminal ?? 'default'
      })
    })
  }, [])

  const handleSave = async (): Promise<void> => {
    await window.api.saveConfig(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addDirectory = (): void => {
    if (newDir.trim() && !settings.scanDirectories.includes(newDir.trim())) {
      setSettings({
        ...settings,
        scanDirectories: [...settings.scanDirectories, newDir.trim()]
      })
      setNewDir('')
    }
  }

  const removeDirectory = (dir: string): void => {
    setSettings({
      ...settings,
      scanDirectories: settings.scanDirectories.filter((d) => d !== dir)
    })
  }

  return (
    <div className="p-5 max-w-xl space-y-6">
      {/* Scan directories */}
      <section>
        <h3 className="text-[13px] font-medium text-zinc-300 mb-2">Scan Directories</h3>
        <p className="text-[12px] text-zinc-600 mb-3">
          Directories to scan for projects with .service-starter.yml manifests
        </p>

        <div className="space-y-1.5 mb-2">
          {settings.scanDirectories.map((dir) => (
            <div
              key={dir}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]"
            >
              <span className="flex-1 text-[13px] font-mono text-zinc-400">{dir}</span>
              <button
                onClick={() => removeDirectory(dir)}
                className="text-zinc-600 hover:text-red-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newDir}
            onChange={(e) => setNewDir(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDirectory()}
            placeholder="~/work/projects"
            className="flex-1 px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-[13px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          <button
            onClick={addDirectory}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-[13px] text-zinc-300 rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </section>

      {/* Intervals */}
      <section>
        <h3 className="text-[13px] font-medium text-zinc-300 mb-2">Scan Intervals</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Project scan (ms)</label>
            <input
              type="number"
              value={settings.scanIntervalMs}
              onChange={(e) => setSettings({ ...settings, scanIntervalMs: parseInt(e.target.value) || 5000 })}
              className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-[13px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Port scan (ms)</label>
            <input
              type="number"
              value={settings.portScanIntervalMs}
              onChange={(e) => setSettings({ ...settings, portScanIntervalMs: parseInt(e.target.value) || 3000 })}
              className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-[13px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Editor & Terminal */}
      <section>
        <h3 className="text-[13px] font-medium text-zinc-300 mb-2">Applications</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] text-zinc-500 block mb-1">Editor</label>
            <select
              value={settings.editor}
              onChange={(e) => setSettings({ ...settings, editor: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-[13px] text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
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
              className="w-full px-3 py-2 bg-zinc-800 border border-white/[0.08] rounded-lg text-[13px] text-zinc-300 focus:outline-none focus:border-zinc-500 transition-colors"
            >
              <option value="default">Terminal.app</option>
              <option value="iterm">iTerm2</option>
              <option value="warp">Warp</option>
              <option value="alacritty">Alacritty</option>
              <option value="kitty">Kitty</option>
            </select>
          </div>
        </div>
      </section>

      {/* Save button */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            saved
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-zinc-100 text-zinc-900 hover:bg-white'
          }`}
        >
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
