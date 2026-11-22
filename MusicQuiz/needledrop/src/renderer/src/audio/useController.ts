import { useEffect, useState } from 'react'
import { player, type PlayerController } from './player'

/** Takes control of playback while the component is mounted; releases (and stops audio) on unmount. */
export function useController(owner: string): PlayerController | null {
  const [controller, setController] = useState<PlayerController | null>(null)
  useEffect(() => {
    const c = player.acquire(owner)
    setController(c)
    return () => {
      c.release()
      setController(null)
    }
  }, [owner])
  return controller
}
