/**
 * Single source of truth for all personal copy.
 * Swap placeholder text here; components never hard-code content.
 */

export interface SocialLink {
  label: string
  href: string
  icon: 'github' | 'linkedin' | 'mail' | 'globe'
}

export type ProjectVisual = 'graph' | 'subtitles' | 'map'

export interface Project {
  id: string
  title: string
  jpTitle: string
  tagline: string
  description: string
  highlights: string[]
  tech: string[]
  /** Which code-rendered mini-preview to draw */
  visual: ProjectVisual
  links: { label: string; href: string }[]
  year: string
}

export interface ExperienceEntry {
  role: string
  org: string
  period: string
  kind: 'work' | 'hackathon' | 'education'
  summary: string
  bullets: string[]
}

export interface SkillGroup {
  category: string
  items: string[]
}

export interface Interest {
  title: string
  jpTitle: string
  blurb: string
  icon: 'guitar' | 'music' | 'tv'
}

const GITHUB = 'https://github.com/bryant-leung'
const LINKEDIN = 'https://www.linkedin.com/in/bryant-leung'

export const profile = {
  name: 'Bryant Leung',
  jpName: 'ブライアント・レオン',
  role: 'Final-Year AI & Computer Science Student · Software Engineer',
  jpRole: 'バーミンガム大学 AI・コンピュータサイエンス専攻',
  location: 'Birmingham, UK',
  tagline: 'Full-stack and machine-learning systems that show their working.',
  bio: [
    "I'm a final-year BSc Artificial Intelligence and Computer Science student at the University of Birmingham, on a first-class average. Over summer 2026 I was the sole engineer at Arete, where I launched a live consulting hackathon that took 550+ applications.",
    'I like systems you can check: a GraphRAG pipeline that cites the report behind every answer, a Chrome extension that transcribes anime locally with Whisper and LangGraph, and a hazard map councils can triage from. I speak Cantonese and English natively, Mandarin at a working level, and Japanese at JLPT N2.',
  ],
  email: 'chunholeung0317@gmail.com',
  cvPath: '/cv.pdf',
  socials: [
    { label: 'GitHub', href: GITHUB, icon: 'github' },
    { label: 'LinkedIn', href: LINKEDIN, icon: 'linkedin' },
  ] as SocialLink[],
  rotatePrompt: 'Rotate the cube to explore',
  jpRotatePrompt: '回して探索する',

  projects: [
    {
      id: 'graphrag-disaster',
      title: 'Cross-Lingual Spatial-Temporal GraphRAG for Disaster Resilience',
      jpTitle: '時空間グラフRAG・防災',
      tagline: 'Question answering over the 2026 Kumamoto earthquake reports, with a citation on every answer.',
      description:
        'My final-year project: a question-answering system over official reports from the 2026 Kumamoto earthquake. Neo4j and PostGIS resolve recency, road closures and routes before the LLM runs, so the model writes from facts the graph has already settled.',
      highlights: [
        'Every answer cites the source report it came from.',
        'Graph and spatial queries settle recency, closures and routing ahead of generation.',
        'Old reports decay in confidence but are never deleted, so the history stays auditable.',
      ],
      tech: ['Python', 'Neo4j', 'PostGIS', 'LLMs'],
      visual: 'graph',
      links: [],
      year: '2026',
    },
    {
      id: 'jimakukasane',
      title: 'JimakuKasane',
      jpTitle: '字幕重ね',
      tagline: 'Chrome extension for learning Japanese from anime.',
      description:
        'A Chrome MV3 extension that adds auto-synced Japanese subtitles under the English ones, with offline JMdict click-for-meaning. When no subtitle file exists, a local Python server transcribes the episode with a LangGraph and Whisper pipeline.',
      highlights: [
        'Word difficulty scored from corpus frequency.',
        '126 N2/N1 grammar patterns matched on conjugated forms.',
        '243 Playwright end-to-end tests, strict TypeScript and versioned releases.',
      ],
      tech: ['TypeScript', 'Python', 'LangGraph', 'Whisper', 'Playwright'],
      visual: 'subtitles',
      links: [{ label: 'GitHub profile', href: GITHUB }],
      year: '2026',
    },
    {
      id: 'civictrace',
      title: 'CivicTrace',
      jpTitle: '市民ハザードマップ',
      tagline: 'Hazard reporting for residents, triage for council staff.',
      description:
        'Built in a team of six for the Software Engineering module. Residents report hazards on an interactive risk heatmap; council staff triage them and track the fixes.',
      highlights: [
        'Top contributor with 61 of 127 commits.',
        'Merged the Python and Node backends into one Express API.',
        'JWT and bcrypt role-based auth, Nominatim geocoding and audit trails.',
      ],
      tech: ['React', 'Leaflet', 'Node / Express', 'PostgreSQL (Supabase)'],
      visual: 'map',
      links: [{ label: 'GitHub profile', href: GITHUB }],
      year: '2025–26',
    },
  ] as Project[],

  experience: [
    {
      role: 'Software Engineer (Internship)',
      org: 'Arete · London, remote',
      period: 'Jul 2026 – Sep 2026',
      kind: 'work',
      summary: 'Sole engineer on a career upskilling platform.',
      bullets: [
        'Led the technical launch of a live consulting hackathon with 550+ applications, building the full lifecycle: eligibility checks, automated timelines and portfolio presentation.',
        "Architected the project-generation engine across role families, scoped to each student's profile so it never fabricates claims.",
        'Owned role analysis and routing, validating ambiguous job titles against verifiable CV evidence.',
        'Hardened the app against injection and common web attacks, centralised configuration and API limits, and added regression tests.',
        'Shipped features end to end, including atomic JSONB updates and OAuth, and worked with judges and partners on the roadmap.',
      ],
    },
    {
      role: 'Career Secretary',
      org: 'University of Birmingham Japan Society',
      period: '2026 – Present',
      kind: 'work',
      summary: 'Connecting students with careers in Japan.',
      bullets: [
        'Share career information from forums such as CFN and TKF, in Japanese, with students who want to work in Japan.',
        'Organise talks when forum representatives visit campus: advertising, room bookings and event planning.',
      ],
    },
    {
      role: 'Decode and Detect · XRPL AML Hackathon',
      org: 'UK CBT · team of 4',
      period: 'Oct 2026',
      kind: 'hackathon',
      summary: 'Anti-money-laundering risk scoring for XRPL transactions.',
      bullets: [
        'Ensemble of LightGBM, XGBoost and CatBoost on 254 engineered features, scoring 40,101 test transactions.',
        'Tested GraphSAGE stacking with out-of-fold scores and time-block cross-validation with a one-hour embargo against label leakage.',
      ],
    },
    {
      role: 'BSc Artificial Intelligence and Computer Science',
      org: 'University of Birmingham',
      period: '2024 – Jun 2027',
      kind: 'education',
      summary: 'First-class average. Top 5 in the UK for Computer Science (Complete University Guide 2026).',
      bullets: [
        'Year 1: 76.3%, including Object-Oriented Programming 94%.',
        'Year 2: 73.3%, including Software Engineering 82% and Functional Programming 76%.',
        'Final year: NLP, Neural Computation, Computer Vision and Imaging, Security of Real-World Systems.',
      ],
    },
    {
      role: 'HKDSE',
      org: "Diocesan Boys' School, Hong Kong",
      period: '2024',
      kind: 'education',
      summary: 'English 5*, Mathematics 5.',
      bullets: ['Vice-Chairman of the Japanese Culture Club and the Diocesan Media Group.'],
    },
  ] as ExperienceEntry[],

  skills: [
    { category: 'Languages', items: ['Python', 'TypeScript / JavaScript', 'Java', 'SQL', 'C', 'Haskell'] },
    { category: 'Web', items: ['React', 'Node.js', 'Express', 'Leaflet', 'REST APIs', 'JWT / RBAC'] },
    { category: 'AI / ML', items: ['LangChain', 'LangGraph', 'RAG', 'Whisper', 'LightGBM', 'XGBoost', 'CatBoost', 'GNNs'] },
    { category: 'Data & Tools', items: ['PostgreSQL', 'PostGIS', 'Neo4j', 'Git', 'Playwright', 'pytest'] },
    {
      category: 'Certifications',
      items: ['LangChain / LangGraph / LangSmith agents (PwC × UoB, 2026)', 'Google AI Studio prototypes (2025)', 'Red Hat Agile Project Management (2025)'],
    },
    { category: 'Spoken', items: ['Cantonese (native)', 'English (native)', 'Mandarin (working)', 'Japanese (JLPT N2)'] },
  ] as SkillGroup[],

  interests: [
    { title: 'Electric guitar', jpTitle: 'エレキギター', blurb: 'Dialling in clean J-rock and indie tones.', icon: 'guitar' },
    { title: 'Japanese music', jpTitle: '邦楽', blurb: 'The soundtrack to most of my coding.', icon: 'music' },
    { title: 'Anime cinematography', jpTitle: 'アニメ撮影', blurb: 'Framing, colour and light; Shaft and Shinkai shaped how this site looks.', icon: 'tv' },
  ] as Interest[],
} as const

export type Profile = typeof profile
