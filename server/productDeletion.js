// No trash table or copied records. Imported status encodes its previous value.
export const LIVE_STATES = ['pending', 'published', 'hidden', 'rejected'];
export const deletedStatus = status => LIVE_STATES.includes(status) ? `deleted-${status}` : null;
export const restoredStatus = status => String(status || '').startsWith('deleted-') && LIVE_STATES.includes(String(status).slice(8)) ? String(status).slice(8) : null;
export const isDeletedStatus = status => restoredStatus(status) !== null;
export const deletedOriginalSlugs = db => Array.isArray(db.deletedProducts) ? db.deletedProducts : [];
export const isDeletedOriginal = (db, slug) => deletedOriginalSlugs(db).includes(slug);
