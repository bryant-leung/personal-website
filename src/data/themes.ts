/** Centralized theme tokens for the four cube faces. Index = face order (0° → -270°). */

export type FaceId = 'intro' | 'projects' | 'experience' | 'contact'

export interface FaceTheme {
  id: FaceId
  /** English nav label */
  label: string
  /** Japanese nav label */
  jpLabel: string
  /** Displayed angle on the compass, e.g. "0°" */
  angleLabel: string
  /** Y rotation applied to the cube to bring this face to the front */
  rotateY: number
  /** Full-viewport ambient background (CSS background value) */
  bgGradient: string
  /** Face panel surface (CSS background value) */
  surfaceBg: string
  borderColor: string
  accentPrimary: string
  /** Secondary accent used for highlights/ribbons */
  accentSecondary: string
  /** Glow colour (rgba) for shadows and halos */
  accentGlow: string
  textPrimary: string
  textMuted: string
}

export const themes: readonly FaceTheme[] = [
  {
    id: 'intro',
    label: 'Intro',
    jpLabel: '序章',
    angleLabel: '0°',
    rotateY: 0,
    bgGradient:
      'radial-gradient(120% 90% at 50% 110%, rgba(124, 58, 237, 0.28) 0%, rgba(7, 7, 10, 0) 55%), radial-gradient(60% 50% at 85% 10%, rgba(225, 29, 72, 0.18) 0%, rgba(7, 7, 10, 0) 60%), linear-gradient(180deg, #07070a 0%, #0c0b14 100%)',
    surfaceBg: 'linear-gradient(160deg, rgba(20, 17, 30, 0.92) 0%, rgba(10, 9, 16, 0.96) 100%)',
    borderColor: 'rgba(167, 139, 250, 0.35)',
    accentPrimary: '#a78bfa',
    accentSecondary: '#e11d48',
    accentGlow: 'rgba(167, 139, 250, 0.45)',
    textPrimary: '#f5f3ff',
    textMuted: '#a1a1aa',
  },
  {
    id: 'projects',
    label: 'Projects',
    jpLabel: '作品',
    angleLabel: '90°',
    rotateY: -90,
    bgGradient:
      'radial-gradient(90% 70% at 50% 100%, rgba(56, 189, 248, 0.22) 0%, rgba(8, 12, 32, 0) 60%), radial-gradient(70% 60% at 20% 0%, rgba(99, 102, 241, 0.28) 0%, rgba(8, 12, 32, 0) 60%), linear-gradient(180deg, #080c20 0%, #0f1a3a 60%, #152a52 100%)',
    surfaceBg: 'linear-gradient(160deg, rgba(20, 30, 70, 0.72) 0%, rgba(10, 16, 40, 0.88) 100%)',
    borderColor: 'rgba(125, 211, 252, 0.35)',
    accentPrimary: '#38bdf8',
    accentSecondary: '#818cf8',
    accentGlow: 'rgba(56, 189, 248, 0.45)',
    textPrimary: '#eff6ff',
    textMuted: '#93a4c3',
  },
  {
    id: 'experience',
    label: 'Experience',
    jpLabel: '経歴',
    angleLabel: '180°',
    rotateY: -180,
    bgGradient:
      'radial-gradient(80% 60% at 50% 105%, rgba(251, 191, 36, 0.35) 0%, rgba(28, 22, 20, 0) 60%), radial-gradient(60% 50% at 90% 20%, rgba(249, 115, 22, 0.22) 0%, rgba(28, 22, 20, 0) 60%), linear-gradient(180deg, #1a1614 0%, #2a211c 55%, #3a2a1f 100%)',
    surfaceBg: 'linear-gradient(160deg, rgba(60, 46, 36, 0.78) 0%, rgba(32, 26, 22, 0.92) 100%)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
    accentPrimary: '#fbbf24',
    accentSecondary: '#fb923c',
    accentGlow: 'rgba(251, 191, 36, 0.45)',
    textPrimary: '#fff7ed',
    textMuted: '#c4b5a5',
  },
  {
    id: 'contact',
    label: 'Contact',
    jpLabel: '連絡',
    angleLabel: '270°',
    rotateY: -270,
    bgGradient:
      'radial-gradient(70% 50% at 70% 0%, rgba(226, 232, 240, 0.16) 0%, rgba(6, 10, 24, 0) 60%), radial-gradient(60% 50% at 20% 100%, rgba(251, 113, 133, 0.14) 0%, rgba(6, 10, 24, 0) 60%), linear-gradient(180deg, #060a18 0%, #0b1226 60%, #111a33 100%)',
    surfaceBg: 'linear-gradient(160deg, rgba(24, 32, 58, 0.78) 0%, rgba(10, 14, 30, 0.92) 100%)',
    borderColor: 'rgba(203, 213, 225, 0.3)',
    accentPrimary: '#cbd5e1',
    accentSecondary: '#fb7185',
    accentGlow: 'rgba(203, 213, 225, 0.35)',
    textPrimary: '#f8fafc',
    textMuted: '#94a3b8',
  },
] as const

export const FACE_COUNT = themes.length

/** Duration (seconds) of one 90° turn; background + CSS vars animate with the same value. */
export const TURN_DURATION = 0.9
