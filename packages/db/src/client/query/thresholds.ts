// Query thresholds
export const MAX_IDS_PER_QUERY = 1e6 // Max number of IDs that can be queried at once
export const MAX_BUFFER_SIZE = 5 * 1024 * 1024 // 5MB (max buffer size)
export const DEF_RANGE_PROP_LIMIT = 1e3
export const DEF_RANGE_REF_LIMIT = 1e4
export const MAX_ID = 4294967295
// Data validation thresholds
export const MIN_ID_VALUE = 1 // Minimum allowed value for an ID (id array stared)
export const MAX_ID_VALUE = 2 ** 32 - 1 /// Maximum allowed value for an ID (Uint32)

// Performance-related thresholds
// <Just making room to further threshoulds e.g. MAX_MEMORY_BLABLABLA>

// Network-related thresholds
// <Just making room to further threshoulds e.g. MAX_NETWORK_RETRIES, NETWORK_TIMEOUT, etc.>

// Security-related thresholds
// <Just making room to further threshoulds that could make sense such. e.g.
// MAX_INPUT_LENGTH (strings/json to prevent DDoS attacks) or MAX_API_DUMP_LENGTH to avoid undesired dumps>
