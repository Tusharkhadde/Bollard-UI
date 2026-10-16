/** Country (ISO 3166 region) of popular zones, so "Japan" or "Brazil" finds them. */
export const ZONE_COUNTRY: Record<string, string> = {
  "Asia/Kolkata": "IN", "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Karachi": "PK", "Asia/Dhaka": "BD",
  "Asia/Kathmandu": "NP", "Asia/Colombo": "LK", "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Bangkok": "TH",
  "Asia/Jakarta": "ID", "Asia/Manila": "PH", "Asia/Ho_Chi_Minh": "VN", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW", "Asia/Seoul": "KR", "Asia/Tokyo": "JP", "Asia/Jerusalem": "IL", "Asia/Qatar": "QA",
  "Asia/Tehran": "IR", "Asia/Kabul": "AF", "Asia/Yangon": "MM", "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Lisbon": "PT", "Europe/Madrid": "ES", "Europe/Paris": "FR",
  "Europe/Brussels": "BE", "Europe/Amsterdam": "NL", "Europe/Berlin": "DE", "Europe/Zurich": "CH", "Europe/Rome": "IT",
  "Europe/Vienna": "AT", "Europe/Prague": "CZ", "Europe/Warsaw": "PL", "Europe/Stockholm": "SE", "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Athens": "GR", "Europe/Bucharest": "RO", "Europe/Kyiv": "UA",
  "Europe/Istanbul": "TR", "Europe/Moscow": "RU", "Africa/Cairo": "EG", "Africa/Lagos": "NG", "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA", "Africa/Casablanca": "MA", "America/New_York": "US", "America/Chicago": "US",
  "America/Denver": "US", "America/Phoenix": "US", "America/Los_Angeles": "US", "America/Anchorage": "US",
  "Pacific/Honolulu": "US", "America/Toronto": "CA", "America/Vancouver": "CA", "America/Halifax": "CA",
  "America/Mexico_City": "MX", "America/Havana": "CU", "America/Bogota": "CO", "America/Lima": "PE", "America/Santiago": "CL",
  "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR", "Australia/Sydney": "AU", "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU", "Australia/Adelaide": "AU", "Australia/Perth": "AU", "Pacific/Auckland": "NZ",
}

/** Extra words people search with. */
export const COUNTRY_ALIASES: Record<string, string> = { usa: "US", america: "US", uk: "GB", england: "GB", britain: "GB", uae: "AE", korea: "KR" }

/** Abbreviations, with every zone each one can mean. Several are ambiguous on purpose. */
export const ZONE_ABBREVIATIONS: Record<string, { zone: string; name: string }[]> = {
  IST: [{ zone: "Asia/Kolkata", name: "India Standard Time" }, { zone: "Asia/Jerusalem", name: "Israel Standard Time" }, { zone: "Europe/Dublin", name: "Irish Standard Time" }],
  PST: [{ zone: "America/Los_Angeles", name: "Pacific Time (US)" }, { zone: "Asia/Manila", name: "Philippine Standard Time" }],
  CST: [{ zone: "America/Chicago", name: "Central Time (US)" }, { zone: "Asia/Shanghai", name: "China Standard Time" }, { zone: "America/Havana", name: "Cuba Standard Time" }],
  BST: [{ zone: "Europe/London", name: "British Summer Time" }, { zone: "Asia/Dhaka", name: "Bangladesh Standard Time" }],
  AST: [{ zone: "America/Halifax", name: "Atlantic Time" }, { zone: "Asia/Riyadh", name: "Arabia Standard Time" }],
  MST: [{ zone: "America/Denver", name: "Mountain Time (changes clocks)" }, { zone: "America/Phoenix", name: "Arizona (no daylight saving)" }],
  GST: [{ zone: "Asia/Dubai", name: "Gulf Standard Time" }, { zone: "Atlantic/South_Georgia", name: "South Georgia Time" }],
  EST: [{ zone: "America/New_York", name: "Eastern Time (US)" }], ET: [{ zone: "America/New_York", name: "Eastern Time (US)" }],
  PT: [{ zone: "America/Los_Angeles", name: "Pacific Time (US)" }], CT: [{ zone: "America/Chicago", name: "Central Time (US)" }],
  GMT: [{ zone: "Europe/London", name: "UK (GMT in winter)" }, { zone: "UTC", name: "Coordinated Universal Time" }],
  UTC: [{ zone: "UTC", name: "Coordinated Universal Time" }], CET: [{ zone: "Europe/Paris", name: "Central European Time" }],
  JST: [{ zone: "Asia/Tokyo", name: "Japan Standard Time" }], KST: [{ zone: "Asia/Seoul", name: "Korea Standard Time" }],
  SGT: [{ zone: "Asia/Singapore", name: "Singapore Time" }], HKT: [{ zone: "Asia/Hong_Kong", name: "Hong Kong Time" }],
  PKT: [{ zone: "Asia/Karachi", name: "Pakistan Standard Time" }], NPT: [{ zone: "Asia/Kathmandu", name: "Nepal Time" }],
  AEST: [{ zone: "Australia/Sydney", name: "Australian Eastern Time" }, { zone: "Australia/Brisbane", name: "Queensland (no daylight saving)" }],
  NZST: [{ zone: "Pacific/Auckland", name: "New Zealand Time" }], SAST: [{ zone: "Africa/Johannesburg", name: "South Africa Time" }],
  EAT: [{ zone: "Africa/Nairobi", name: "East Africa Time" }], WAT: [{ zone: "Africa/Lagos", name: "West Africa Time" }],
  MSK: [{ zone: "Europe/Moscow", name: "Moscow Time" }], BRT: [{ zone: "America/Sao_Paulo", name: "Brasília Time" }],
}

/** Old names some browsers still report, mapped to today's name. */
export const LEGACY_ZONES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata", "Asia/Saigon": "Asia/Ho_Chi_Minh", "Europe/Kiev": "Europe/Kyiv",
  "Asia/Rangoon": "Asia/Yangon", "Asia/Katmandu": "Asia/Kathmandu", "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
}
