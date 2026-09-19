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

// Raw GET /clubs/:id bodies for the preview clubs: the database rows, exactly as the backend returns them.
// They deliberately include things the panel must never show (contact links, emails, description_raw,
// pending_review and past events), so /?previewData exercises lib/club.js sanitizeClub.
// preview-robotics has no entry on purpose: it exercises the 404 fallback.
const inDays = (n, hour = 18) => {
  const d = new Date(Date.now() + n * 86_400_000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}
// Keep the card's own event time while it is still in the future; otherwise use a relative one.
const keepIfFuture = (iso, fallbackDays, hour) => (Date.parse(iso) > Date.now() ? iso : inDays(fallbackDays, hour))

export const previewClubDetails = {
  'preview-venture-capital': {
    club: {
      id: 'preview-venture-capital',
      name: 'UofT Venture Capital Club',
      campus: 'St. George',
      summary: 'Student-run group exploring startup investing through workshops, founder talks and pitch nights.',
      description_raw: '<p>UofT VC. Email exec@uoftvc.example.com or call (416) 555-0199 to get involved.</p>',
      commitment: 'moderate',
      meeting_info: 'Thursdays 6–7:30 PM in term, Bahen Centre. Questions? exec@uoftvc.example.com',
      sop_url: 'https://sop.utoronto.ca/group/uoft-venture-capital-club/',
      links: {
        instagram: 'https://www.instagram.com/example_uoftvc/',
        website: 'https://uoftvc.example.com',
        contact_email: 'mailto:exec@uoftvc.example.com',
      },
      last_updated: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      source: 'sop',
    },
    events: [
      {
        id: 'preview-event-1',
        club_id: 'preview-venture-capital',
        title: 'Info Session',
        start: keepIfFuture(previewClubs[0].next_event.start, 5, 18),
        location: 'Bahen Centre',
        source: 'dropbox',
        source_file: 'poster.png',
        dropbox_link: 'https://www.dropbox.com/s/preview/poster.png',
        status: 'published',
        confidence: 0.94,
      },
      {
        id: 'preview-event-3',
        club_id: 'preview-venture-capital',
        title: 'Pitch Night',
        start: inDays(12, 19),
        end: inDays(12, 21),
        location: 'Myhal Centre',
        rsvp_url: 'https://example.com/rsvp/pitch-night',
        source: 'sop',
        status: 'published',
      },
      {
        id: 'preview-event-4',
        club_id: 'preview-venture-capital',
        title: 'SHOULD NOT SHOW (pending review)',
        start: inDays(3, 17),
        source: 'dropbox',
        source_file: 'blurry-scan.png',
        status: 'pending_review',
        confidence: 0.41,
      },
      {
        id: 'preview-event-5',
        club_id: 'preview-venture-capital',
        title: 'SHOULD NOT SHOW (past event)',
        start: inDays(-9, 18),
        source: 'sop',
        status: 'published',
      },
    ],
    similar: [],
  },
  'preview-board-games': {
    club: {
      id: 'preview-board-games',
      name: 'St. George Board Games Society',
      campus: 'St. George',
      summary: 'limited info',
      description_raw: 'Board games.',
      commitment: 'casual',
      meeting_info: null,
      sop_url: 'https://sop.utoronto.ca/group/st-george-board-games-society/',
      links: {},
      last_updated: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      source: 'sop',
    },
    events: [
      {
        id: 'preview-event-2',
        club_id: 'preview-board-games',
        title: 'Weekly Game Night',
        start: keepIfFuture(previewClubs[1].next_event.start, 7, 19),
        location: 'Hart House',
        source: 'sop',
        status: 'published',
      },
    ],
    similar: [],
  },
}
