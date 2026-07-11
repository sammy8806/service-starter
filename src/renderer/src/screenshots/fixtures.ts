import type { AppStateView } from '../context/AppContext'

export const DEMO_STATE: AppStateView = {
  trayIcon: 'orange',
  favorites: ['shop-platform'],
  conflicts: [
    {
      port: 3000,
      type: 'static',
      claimants: ['shop-platform/frontend', 'analytics/web'],
      activeProcess: 'node',
      activePid: 4821
    }
  ],
  projects: {
    'shop-platform': {
      name: 'shop-platform',
      directory: '/Users/dev/projects/shop-platform',
      dependencies: [
        {
          dependency: { type: 'docker', container: 'postgres', image: 'postgres:16' },
          health: 'healthy',
          lastChecked: Date.now(),
          docker: {
            state: 'running',
            matchedName: 'shop-platform_postgres_1',
            containerId: 'a1b2c3d4e5f6',
            image: 'postgres:16-alpine',
            statusText: 'Up 3 hours'
          }
        },
        {
          dependency: { type: 'docker', container: 'redis' },
          health: 'healthy',
          lastChecked: Date.now(),
          docker: {
            state: 'running',
            matchedName: 'redis',
            image: 'redis:7-alpine',
            statusText: 'Up 3 hours'
          }
        }
      ],
      components: {
        backend: {
          name: 'backend',
          status: 'running',
          processOrigin: 'managed',
          startedAt: Date.now() - 3_600_000,
          hasServiceLog: true,
          dependencies: [
            {
              dependency: { type: 'docker', container: 'postgres' },
              health: 'healthy',
              lastChecked: Date.now(),
              docker: {
                state: 'running',
                matchedName: 'shop-platform_postgres_1',
                statusText: 'Up 3 hours'
              }
            }
          ],
          ports: [
            { port: 8090, label: 'api', status: 'in-use', process: 'java', pid: 4102 }
          ]
        },
        frontend: {
          name: 'frontend',
          status: 'running',
          processOrigin: 'managed',
          startedAt: Date.now() - 1_800_000,
          hasServiceLog: true,
          dependencies: [],
          ports: [
            { port: 3000, label: 'web', status: 'conflict', process: 'node', pid: 4821 }
          ]
        },
        worker: {
          name: 'worker',
          status: 'stopped',
          processOrigin: 'none',
          dependencies: [
            {
              dependency: { type: 'docker', container: 'rabbitmq' },
              health: 'unhealthy',
              lastChecked: Date.now(),
              docker: {
                state: 'stopped',
                matchedName: 'rabbitmq',
                image: 'rabbitmq:3-management',
                statusText: 'Exited (137) 10 minutes ago'
              },
              error: 'Container "rabbitmq" is exited'
            }
          ],
          ports: []
        }
      }
    },
    analytics: {
      name: 'analytics',
      directory: '/Users/dev/projects/analytics',
      dependencies: [
        {
          dependency: { type: 'docker', container: 'clickhouse' },
          health: 'unhealthy',
          lastChecked: Date.now(),
          docker: {
            state: 'not_found',
            image: 'clickhouse/clickhouse-server'
          },
          error: 'Container "clickhouse" not found'
        }
      ],
      components: {
        api: {
          name: 'api',
          status: 'running',
          processOrigin: 'external',
          dependencies: [],
          ports: [{ port: 4000, label: 'api', status: 'in-use', process: 'go', pid: 5100 }]
        },
        web: {
          name: 'web',
          status: 'stopped',
          processOrigin: 'none',
          dependencies: [],
          ports: [{ port: 3000, label: 'web', status: 'conflict' }]
        }
      }
    },
    'legacy-cms': {
      name: 'legacy-cms',
      directory: '/Users/dev/projects/legacy-cms',
      dependencies: [],
      components: {
        nginx: {
          name: 'nginx',
          status: 'stopped',
          processOrigin: 'none',
          dependencies: [],
          ports: [{ port: 8080, label: 'proxy', status: 'free' }]
        }
      }
    }
  }
}

export const DEMO_LOG = `[2026-07-09 14:32:01] INFO  Starting backend on :8090
[2026-07-09 14:32:02] INFO  Connected to postgres://localhost:5432/shop
[2026-07-09 14:32:03] INFO  Migrations applied (v42)
[2026-07-09 14:32:04] INFO  Server ready — health check passed
[2026-07-09 14:35:12] INFO  GET /api/products 200 23ms
[2026-07-09 14:35:18] INFO  GET /api/products/42 200 8ms
[2026-07-09 14:36:01] WARN  Cache miss for key products:featured
[2026-07-09 14:36:02] INFO  GET /api/products 200 45ms
[2026-07-09 14:38:44] INFO  POST /api/orders 201 112ms
[2026-07-09 14:39:01] INFO  Order #8821 queued for fulfillment`

export const DEMO_CONFIG = {
  scanDirectories: ['/Users/dev/projects', '/Users/dev/work'],
  scanIntervalMs: 5000,
  portScanIntervalMs: 3000,
  editor: 'cursor',
  terminal: 'iterm',
  gitGui: 'fork'
}

export const DEMO_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: '8090',
  DATABASE_URL: 'postgres://localhost:5432/shop',
  REDIS_URL: 'redis://localhost:6379',
  LOG_LEVEL: 'info'
}
