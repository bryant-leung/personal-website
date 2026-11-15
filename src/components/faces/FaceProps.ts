import type { FaceTheme } from '../../data/themes'

export interface FaceProps {
  theme: FaceTheme
  active: boolean
  onRotate?: (direction: 1 | -1) => void
}
