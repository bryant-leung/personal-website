/** sessionStorage flag set once the intro has played. Kept apart from EntranceSequence so
 *  App can read it without pulling the lazily loaded 3D intro (and Three.js) into the main bundle. */
export const ENTRANCE_DONE_KEY = 'portfolio:entrance-done'
