export interface BoundPortLike {
  status: 'free' | 'in-use' | 'conflict'
  pid?: number
}

export function isPortBound(port: BoundPortLike): boolean {
  return port.status === 'in-use' || (port.status === 'conflict' && typeof port.pid === 'number')
}

export function hasBoundPort<T extends BoundPortLike>(ports: T[]): boolean {
  return ports.some(isPortBound)
}

export function findBoundPort<T extends BoundPortLike>(ports: T[]): T | undefined {
  return ports.find(isPortBound)
}
