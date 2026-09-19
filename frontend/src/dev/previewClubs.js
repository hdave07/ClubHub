// Dev preview only. Never imported by the real flow.
// Shape follows backend/app/schemas.py ClubMatch plus the fields in src/types.js.
// Outcomes are display labels because that is what the backend currently sends.
export const previewClubs = [
  {
    id: 'preview-venture-capital',
    name: 'UofT Venture Capital Club',
    summary: 'Student-run group exploring startup investing through workshops and pitch nights.',
    outcomes: ['Career and networking', 'Build skills/portfolio'],
    tags: ['startups', 'investing', 'finance'],
    commitment: 'moderate',
    why_it_fits: 'Fits your interest in finance and gives hands-on deal experience.',
    last_updated: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    next_event: {
      id: 'preview-event-1',
      title: 'Info Session',
      start: '2026-09-24T18:00:00-04:00',
      location: 'Bahen Centre',
      source: 'dropbox',
      source_file: 'poster.png',
      dropbox_link: 'https://www.dropbox.com/s/preview/poster.png',
    },
  },
  {
    id: 'preview-board-games',
    name: 'St. George Board Games Society',
    summary: 'limited info',
    outcomes: ['Make friends', 'Wellness and recreation'],
    tags: ['games', 'social'],
    commitment: 'casual',
    why_it_fits: 'A low-pressure way to meet people without a big time commitment.',
    last_updated: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    next_event: {
      id: 'preview-event-2',
      title: 'Weekly Game Night',
      start: '2026-09-26T19:00:00-04:00',
      location: 'Hart House',
      source: 'sop',
    },
  },
  {
    id: 'preview-robotics',
    name: 'UofT Robotics Team',
    summary: 'Builds and competes with autonomous robots; open to all engineering and CS students.',
    outcomes: ['Build skills/portfolio', 'Academic/research'],
    tags: ['robotics', 'engineering', 'projects'],
    commitment: 'intense',
    why_it_fits: 'Project-based work that builds a portfolio alongside teammates.',
    last_updated: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    next_event: null,
  },
]
