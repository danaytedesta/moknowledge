// A conservative review flag, not a truth check or legal classification.
// "Best shots", "best wishes", and "do our best" are not ranking claims.
// Keep stronger comparative wording, explicit promises, and delivery times.
export const claimPattern =
  /\b(?:guarantee(?:d|s)?|risk[- ]free|certified|certification|licensed|licensing|insured|insurance|award[- ]winning|cure[sd]?|voted|accredited)\b|#\s*1\b|\b(?:the\s+best\s+(?!of\b|shots?\b|wishes\b|way\b|time\b|part\b|thing\b)[a-z]+|best[- ](?:in[- ]class|rated|selling)|best\s+in\s+(?:the|our|your|[A-Z]))|\b(?:within|in|under)\s+(?:an?\s+)?(?:\d+|one|two|three|four|five|six|seven|a)\s*(?:hours?|days?|weeks?)\b/i;
