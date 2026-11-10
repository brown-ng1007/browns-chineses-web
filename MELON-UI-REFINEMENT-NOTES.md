# Melon UI refinement – November 2026

This patch improves the IOE game visuals and the English/Chinese learning-roadmap presentation while preserving the current game logic and progress calculations.

## Included
- Replaced the previous IOE thumbnails with 12 locally hosted illustrated scenes: matching, football, letter detective, sentence ordering, jungle, underwater, mountain, pirate ship, octopus, trophy, listening, and reading.
- Added 12 short H.264 MP4 scene loops with WebP poster fallbacks. All media is local under `public/ioe/` and does not depend on an external CDN.
- Removed oversized emoji overlays from the active IOE game scene; scene art, scene label, and question UI are separate layers.
- Updated all 29 expanded IOE activity thumbnails to use a scene that matches their activity group.
- Added the dependency-free `src/lib/content/contract.ts` foundation: subject types, renderer registry, versioned question/lesson contracts, and runtime validation for AI/imported content. The IOE activity types now share this renderer-kind contract.
- Updated the four Quick Play tiles to use the new artwork while retaining their horizontal card layout.
- Added an English Quest roadmap summary using the existing stage/star rules (complete, use in a sentence, recall next day). The English theme uses navy/blue/amber expedition styling.
- Added a Chinese Garden roadmap summary using existing HSK, SRS, daily-target, streak, and watermelon-tree data. The Chinese theme keeps the botanical/jade/ivory/watermelon identity.
- Chinese overall progress is calculated against the learner's own SRS card set, not the entire HSK dictionary.

## Compatibility and safety
- No existing Supabase tables, RLS policies, or database rows are changed by this patch.
- No SRS interval, HSK floor split, daily target, star threshold, game scoring, or saved-progress key is changed.
- No `.env.local`, `.git`, `node_modules`, `.next`, or deployment credentials are included.
- Video autoplay may be restricted by a browser; each video therefore has a WebP poster fallback.
- The Auto Content backend/database phase is not part of this UI patch. It must be implemented only after checking the live Supabase schema and existing policies.

## Apply
Extract/overlay the ZIP into the existing project root, preserving `.git` and `.env.local`. Then run the local build before pushing to GitHub/Vercel.
