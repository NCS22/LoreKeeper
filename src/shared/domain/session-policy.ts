const SECONDS_IN_ONE_DAY = 24 * 60 * 60;

/** A session unused for this long is closed (FR-24). The only definition of this number. */
export const SESSION_LIFETIME_IN_SECONDS = 30 * SECONDS_IN_ONE_DAY;

/** A session in use has its expiry extended at most once per this interval (FR-23). */
export const SESSION_RENEWAL_INTERVAL_IN_SECONDS = SECONDS_IN_ONE_DAY;
