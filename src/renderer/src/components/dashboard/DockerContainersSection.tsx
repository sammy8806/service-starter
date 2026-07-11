import type { DockerSnapshotView } from '../../context/AppContext'
import { Section } from './ui/Section'
import { DockerContainerActions } from './DockerContainerActions'
import { dockerStateClass, formatUsedBy } from '../../utils/dockerDisplay'

interface DockerContainersSectionProps {
  docker: DockerSnapshotView
}

export function DockerContainersSection({ docker }: DockerContainersSectionProps): React.JSX.Element {
  return (
    <Section title="Docker">
      {!docker.available && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-400/[0.03] px-4 py-3 text-[12px] text-amber-300">
          Docker is not available{docker.error ? `: ${docker.error}` : ''}
        </div>
      )}

      {docker.containers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-800/50 text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Name
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Image
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  State
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Used by
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {docker.containers.map((container) => (
                <tr key={container.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-zinc-200">{container.name}</div>
                    <div className="font-mono text-[11px] text-zinc-600">{container.id}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400">{container.image}</td>
                  <td className="px-4 py-2.5">
                    <span className={`font-mono text-[12px] ${dockerStateClass(container.state)}`}>
                      {container.state}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-zinc-300">{container.status}</td>
                  <td className="px-4 py-2.5 text-[11px] text-zinc-500">{formatUsedBy(container.usedBy)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <DockerContainerActions container={container} compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : docker.available ? (
        <p className="text-[12px] text-zinc-500">No containers found on this machine.</p>
      ) : null}

      {docker.missing.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-amber-500/20">
          <div className="bg-amber-400/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-amber-400/80">
            Declared in manifests but not found
          </div>
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-white/[0.04]">
              {docker.missing.map((missing) => (
                <tr key={missing.ref}>
                  <td className="px-4 py-2.5 font-medium text-zinc-300">{missing.ref}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-500">{missing.image ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[11px] text-zinc-500">{formatUsedBy(missing.usedBy)}</td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-amber-400">not found</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
