-- Sanity-check queries for backend/data/campus_compass.db
-- Run with: sqlite3 data/campus_compass.db ".headers on" ".mode column" ".read data/validation_queries.sql"
-- or paste individual queries into DB Browser for SQLite's "Execute SQL" tab.

-- 1. Row counts by source (sop vs dropbox) -- sanity check both ingestion paths
SELECT source, COUNT(*) AS n FROM club GROUP BY source;

-- 2. Dedupe check: sop_original_id must be unique -- any row here means the
--    copy-of-* collapse logic in sop_sync.upsert_club() failed
SELECT sop_original_id, COUNT(*) AS n, GROUP_CONCAT(name, ' | ') AS names
FROM club GROUP BY sop_original_id HAVING n > 1;

-- 3. Enrichment coverage: which clubs still need enrich_club() run
SELECT name, CASE WHEN summary IS NULL THEN 'pending' ELSE 'done' END AS status
FROM club ORDER BY status, name;

-- 4. Thin descriptions -- CLAUDE.md says these should get "limited info" summaries,
--    never invented detail. Anything under ~200 chars is worth eyeballing once enriched.
SELECT name, LENGTH(description_raw) AS desc_len
FROM club ORDER BY desc_len ASC LIMIT 10;

-- 5. Outcomes must only ever contain values from FIXED_OUTCOMES (models.py) and
--    be 1-3 items once enriched -- catches a bad/hallucinated enrichment response
SELECT name, outcomes FROM club WHERE summary IS NOT NULL;

-- 6. Tags come from the controlled vocabulary FIXED_TAGS (models.py): 3-8 per club,
--    lowercase. Thin listings legitimately land at 3-4; fewer than 3 means the source
--    text was too sparse to classify, not that enrichment failed.
SELECT name, tags, json_array_length(tags) AS tag_count
FROM club WHERE summary IS NOT NULL ORDER BY tag_count;

-- 6b. Tag vocabulary health -- how often is each tag actually reused? Free-form tags
--     drifted to ~1 use each (148 unique across 177 assignments) before FIXED_TAGS.
--     A long tail of single-use tags means the vocabulary has drifted again.
SELECT j.value AS tag, COUNT(*) AS clubs
FROM club, json_each(club.tags) AS j
WHERE club.summary IS NOT NULL
GROUP BY j.value ORDER BY clubs DESC;

-- 6c. Rows stranded on an OLD vocabulary after editing FIXED_TAGS. Fix with:
--     python -m app.services.enrichment_batch --stale-tags
--     (--force won't do it: that re-runs the first N clubs by name, so rows late in
--     the alphabet stay stale while the early ones look correct.)
SELECT name, tags FROM club
WHERE summary IS NOT NULL AND EXISTS (
  SELECT 1 FROM json_each(club.tags) AS j
  WHERE j.value NOT IN (
    -- keep in sync with models.FIXED_TAGS
    'artificial intelligence','technology','engineering','science','health and medicine',
    'mental health','business','finance','entrepreneurship','consulting','law','politics',
    'humanities','social sciences','languages','education','music','dance','theatre',
    'visual arts','creative writing','film and media','design','workshops','competitions',
    'conferences','research','mentorship','volunteering','networking','social events',
    'performance','training and lessons','hackathons','publishing','fundraising',
    'cultural heritage','faith and spirituality','international students','graduate students',
    'advocacy','human rights','equity and inclusion','community outreach','sustainability',
    'student government','sports','fitness','games','outdoors','food'
  )
);

-- 7. Expired listings that should have been filtered by sop_sync -- should return 0 rows
SELECT name, listing_expires FROM club WHERE listing_expires < datetime('now');

-- 8. Events with a real event-organizer email leaked into a public field --
--    CLAUDE.md hard constraint: this must NEVER happen. Should always return 0 rows.
SELECT id, title, description FROM event
WHERE description LIKE '%@%' OR location LIKE '%@%';

-- 9. Events missing title/start that got auto-published anyway -- should be
--    pending_review per the extraction.py confidence rule, not published
SELECT id, title, start, status, confidence
FROM event WHERE status = 'published' AND (title IS NULL OR start IS NULL);

-- 10. Full single-row dump (swap the id) -- fastest way to eyeball one club's shape
SELECT * FROM club WHERE sop_original_id = '25046';
