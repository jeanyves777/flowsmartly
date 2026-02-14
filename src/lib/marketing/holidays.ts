import { addDays, startOfDay, isBefore, isEqual, isAfter } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Holiday {
  id: string;
  name: string;
  month: number; // 1-12
  day: number; // 1-31 (for fixed holidays) or 0 (for computed)
  category: "major" | "commercial" | "cultural";
  icon: string; // emoji
  defaultSubject: string; // default email subject template
  promptHint: string; // hint for AI generation
}

// ---------------------------------------------------------------------------
// Internal helpers for floating / computed holidays
// ---------------------------------------------------------------------------

/**
 * Return the date of the Nth occurrence of a given weekday in a month.
 * @param year  Full year (e.g. 2026)
 * @param month 1-12
 * @param dow   Day of week: 0 = Sunday, 1 = Monday, ... 6 = Saturday
 * @param n     Which occurrence (1 = first, 2 = second, etc.)
 */
function getNthDayOfMonth(
  year: number,
  month: number,
  dow: number,
  n: number
): { month: number; day: number } {
  // First day of the month
  const first = new Date(year, month - 1, 1);
  const firstDow = first.getDay(); // 0-6
  // Offset to the first occurrence of the target weekday
  let offset = dow - firstDow;
  if (offset < 0) offset += 7;
  const day = 1 + offset + (n - 1) * 7;
  return { month, day };
}

/**
 * Return the date of the LAST occurrence of a given weekday in a month.
 * @param year  Full year
 * @param month 1-12
 * @param dow   Day of week: 0 = Sunday ... 6 = Saturday
 */
function getLastDayOfMonth(
  year: number,
  month: number,
  dow: number
): { month: number; day: number } {
  // Last day of the month
  const lastDate = new Date(year, month, 0); // day 0 of next month = last day of this month
  const lastDay = lastDate.getDate();
  const lastDow = lastDate.getDay();
  let offset = lastDow - dow;
  if (offset < 0) offset += 7;
  const day = lastDay - offset;
  return { month, day };
}

/**
 * Computus: Anonymous Gregorian algorithm for computing Easter Sunday.
 * Returns { month, day } for the given year.
 */
function computeEaster(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// ---------------------------------------------------------------------------
// Holiday Data
// ---------------------------------------------------------------------------

export const US_HOLIDAYS: Holiday[] = [
  {
    id: "new-years-day",
    name: "New Year's Day",
    month: 1,
    day: 1,
    category: "major",
    icon: "\u{1F389}", // party popper
    defaultSubject: "Happy New Year! Start Fresh with Us",
    promptHint:
      "Create an uplifting, celebratory email welcoming the new year with themes of fresh starts, new goals, resolutions, and exclusive new-year offers",
  },
  {
    id: "mlk-day",
    name: "Martin Luther King Jr. Day",
    month: 1,
    day: 0,
    category: "cultural",
    icon: "\u270A", // raised fist
    defaultSubject: "Honoring Dr. King's Legacy",
    promptHint:
      "Create an inspiring email honoring Martin Luther King Jr. Day with themes of unity, justice, service, and community. Include a call to action for giving back.",
  },
  {
    id: "valentines-day",
    name: "Valentine's Day",
    month: 2,
    day: 14,
    category: "commercial",
    icon: "\u{2764}\u{FE0F}", // red heart
    defaultSubject: "Spread the Love This Valentine's Day",
    promptHint:
      "Create a warm, romantic-themed email about love, appreciation, and special Valentine's Day offers",
  },
  {
    id: "presidents-day",
    name: "Presidents' Day",
    month: 2,
    day: 0,
    category: "major",
    icon: "\u{1F1FA}\u{1F1F8}", // US flag
    defaultSubject: "Presidents' Day Sale \u2014 Big Savings Await!",
    promptHint:
      "Create a patriotic email for Presidents' Day with themes of leadership, history, and exclusive holiday weekend sales and deals",
  },
  {
    id: "st-patricks-day",
    name: "St. Patrick's Day",
    month: 3,
    day: 17,
    category: "cultural",
    icon: "\u2618\u{FE0F}", // shamrock
    defaultSubject: "Get Lucky This St. Patrick's Day!",
    promptHint:
      "Create a fun, festive email for St. Patrick's Day with themes of luck, green, Irish culture, and lucky deals or promotions",
  },
  {
    id: "easter",
    name: "Easter",
    month: 0,
    day: 0,
    category: "cultural",
    icon: "\u{1F430}", // rabbit face
    defaultSubject: "Hoppy Easter! Spring Into Savings",
    promptHint:
      "Create a cheerful, spring-themed email celebrating Easter with themes of renewal, family, and seasonal promotions",
  },
  {
    id: "tax-day",
    name: "Tax Day",
    month: 4,
    day: 15,
    category: "commercial",
    icon: "\u{1F4B0}", // money bag
    defaultSubject: "Tax Day Deals \u2014 Treat Yourself, {{firstName}}!",
    promptHint:
      "Create an email for Tax Day with themes of financial savvy, tax savings, treat-yourself-after-taxes deals, and money-saving promotions",
  },
  {
    id: "mothers-day",
    name: "Mother's Day",
    month: 5,
    day: 0,
    category: "commercial",
    icon: "\u{1F490}", // bouquet
    defaultSubject: "Celebrate Mom This Mother's Day",
    promptHint:
      "Create a heartfelt email honoring mothers and maternal figures with gift ideas, appreciation messages, and special Mother's Day offers",
  },
  {
    id: "memorial-day",
    name: "Memorial Day",
    month: 5,
    day: 0,
    category: "major",
    icon: "\u{1F1FA}\u{1F1F8}", // US flag
    defaultSubject: "Honor & Save This Memorial Day Weekend",
    promptHint:
      "Create a respectful email honoring those who served while highlighting Memorial Day weekend sales, outdoor activities, and summer kick-off deals",
  },
  {
    id: "fathers-day",
    name: "Father's Day",
    month: 6,
    day: 0,
    category: "commercial",
    icon: "\u{1F454}", // necktie
    defaultSubject: "Make Dad's Day Extra Special",
    promptHint:
      "Create a warm email celebrating fathers and father figures with gift guides, appreciation messages, and Father's Day promotions",
  },
  {
    id: "independence-day",
    name: "Independence Day",
    month: 7,
    day: 4,
    category: "major",
    icon: "\u{1F386}", // fireworks
    defaultSubject: "Celebrate the 4th of July with a Bang!",
    promptHint:
      "Create a patriotic, festive email celebrating Independence Day with themes of freedom, fireworks, summer fun, and Fourth of July sales",
  },
  {
    id: "back-to-school",
    name: "Back to School",
    month: 8,
    day: 15,
    category: "commercial",
    icon: "\u{1F4DA}", // books
    defaultSubject: "Back to School \u2014 New Season, Fresh Start!",
    promptHint:
      "Create an energetic email for Back to School season with themes of fresh starts, new beginnings, school supplies, and seasonal deals",
  },
  {
    id: "labor-day",
    name: "Labor Day",
    month: 9,
    day: 0,
    category: "major",
    icon: "\u{1F528}", // hammer
    defaultSubject: "Last Call for Summer \u2014 Labor Day Deals Inside",
    promptHint:
      "Create an email marking the end of summer with Labor Day weekend sales, back-to-school themes, and last-chance summer promotions",
  },
  {
    id: "halloween",
    name: "Halloween",
    month: 10,
    day: 31,
    category: "cultural",
    icon: "\u{1F383}", // jack-o-lantern
    defaultSubject: "Spooktacular Deals This Halloween!",
    promptHint:
      "Create a fun, spooky-themed email for Halloween with costume ideas, trick-or-treat vibes, and frighteningly good deals",
  },
  {
    id: "veterans-day",
    name: "Veterans Day",
    month: 11,
    day: 11,
    category: "major",
    icon: "\u{1F396}\u{FE0F}", // military medal
    defaultSubject: "Honoring Our Veterans \u2014 Thank You for Your Service",
    promptHint:
      "Create a respectful, patriotic email honoring veterans and active service members with themes of gratitude, sacrifice, and Veterans Day deals or donations",
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    month: 11,
    day: 0,
    category: "major",
    icon: "\u{1F983}", // turkey
    defaultSubject: "We're Thankful for You \u2014 Happy Thanksgiving!",
    promptHint:
      "Create a warm, grateful email expressing thanks to customers with themes of gratitude, family gatherings, and Thanksgiving meal inspiration",
  },
  {
    id: "black-friday",
    name: "Black Friday",
    month: 11,
    day: 0,
    category: "commercial",
    icon: "\u{1F6CD}\u{FE0F}", // shopping bags
    defaultSubject: "Black Friday Deals Are Here!",
    promptHint:
      "Create an urgent, exciting email about Black Friday deals, discounts, and limited-time offers with a strong sense of urgency and FOMO",
  },
  {
    id: "small-business-saturday",
    name: "Small Business Saturday",
    month: 11,
    day: 0,
    category: "commercial",
    icon: "\u{1F3EA}", // convenience store
    defaultSubject: "Shop Small This Saturday \u2014 Support Local!",
    promptHint:
      "Create an encouraging email for Small Business Saturday with themes of supporting local businesses, shopping small, community, and unique finds",
  },
  {
    id: "cyber-monday",
    name: "Cyber Monday",
    month: 11,
    day: 0,
    category: "commercial",
    icon: "\u{1F4BB}", // laptop
    defaultSubject: "Cyber Monday: Biggest Online Deals of the Year",
    promptHint:
      "Create a tech-savvy, deal-focused email about Cyber Monday online-only discounts, flash sales, and digital doorbusters",
  },
  {
    id: "hanukkah",
    name: "Hanukkah",
    month: 12,
    day: 0,
    category: "cultural",
    icon: "\u{1F54E}", // menorah
    defaultSubject: "Happy Hanukkah! Celebrate the Festival of Lights",
    promptHint:
      "Create a warm, respectful email celebrating Hanukkah with themes of the Festival of Lights, family, miracles, and eight nights of celebration",
  },
  {
    id: "christmas-eve",
    name: "Christmas Eve",
    month: 12,
    day: 24,
    category: "major",
    icon: "\u{1F384}", // Christmas tree
    defaultSubject: "It's Christmas Eve, {{firstName}}! Last Chance for Holiday Magic",
    promptHint:
      "Create an exciting, anticipation-filled email for Christmas Eve with themes of last-minute gifts, holiday excitement, and the magic of the season",
  },
  {
    id: "christmas",
    name: "Christmas",
    month: 12,
    day: 25,
    category: "major",
    icon: "\u{1F384}", // Christmas tree
    defaultSubject: "Merry Christmas! Unwrap Something Special",
    promptHint:
      "Create a festive, joyful email celebrating Christmas with holiday cheer, gift-giving spirit, year-end gratitude, and seasonal promotions",
  },
  {
    id: "kwanzaa",
    name: "Kwanzaa",
    month: 12,
    day: 26,
    category: "cultural",
    icon: "\u{1F56F}\u{FE0F}", // candle
    defaultSubject: "Happy Kwanzaa! Celebrating Unity & Heritage",
    promptHint:
      "Create a respectful, culturally rich email celebrating Kwanzaa with themes of the seven principles (Nguzo Saba), unity, self-determination, community, and heritage",
  },
  {
    id: "new-years-eve",
    name: "New Year's Eve",
    month: 12,
    day: 31,
    category: "cultural",
    icon: "\u{1F37E}", // bottle with popping cork
    defaultSubject: "Ring In the New Year with Us!",
    promptHint:
      "Create an exciting, countdown-themed email for New Year's Eve with year-in-review highlights, celebration vibes, and last-chance year-end offers",
  },
];

// ---------------------------------------------------------------------------
// Hanukkah lookup (Hebrew calendar — dates vary each year)
// First night of Hanukkah for years 2024-2035
// ---------------------------------------------------------------------------

const HANUKKAH_DATES: Record<number, { month: number; day: number }> = {
  2024: { month: 12, day: 25 },
  2025: { month: 12, day: 14 },
  2026: { month: 12, day: 4 },
  2027: { month: 11, day: 24 },
  2028: { month: 12, day: 12 },
  2029: { month: 12, day: 1 },
  2030: { month: 12, day: 20 },
  2031: { month: 12, day: 9 },
  2032: { month: 11, day: 27 },
  2033: { month: 12, day: 16 },
  2034: { month: 12, day: 6 },
  2035: { month: 11, day: 25 },
};

function getHanukkahDate(year: number): { month: number; day: number } {
  if (HANUKKAH_DATES[year]) {
    return HANUKKAH_DATES[year];
  }
  // Fallback: approximate to Dec 10 if year not in table
  return { month: 12, day: 10 };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the concrete date (month & day) of a holiday for a given year.
 * Fixed holidays simply return their stored month/day.
 * Computed holidays (day === 0) are calculated dynamically.
 */
export function getHolidayDate(
  holiday: Holiday,
  year: number
): { month: number; day: number } {
  // Fixed-date holidays
  if (holiday.day !== 0) {
    return { month: holiday.month, day: holiday.day };
  }

  switch (holiday.id) {
    case "mlk-day":
      // 3rd Monday of January
      return getNthDayOfMonth(year, 1, 1, 3);

    case "presidents-day":
      // 3rd Monday of February
      return getNthDayOfMonth(year, 2, 1, 3);

    case "easter":
      return computeEaster(year);

    case "mothers-day":
      // 2nd Sunday of May
      return getNthDayOfMonth(year, 5, 0, 2);

    case "memorial-day":
      // Last Monday of May
      return getLastDayOfMonth(year, 5, 1);

    case "fathers-day":
      // 3rd Sunday of June
      return getNthDayOfMonth(year, 6, 0, 3);

    case "labor-day":
      // 1st Monday of September
      return getNthDayOfMonth(year, 9, 1, 1);

    case "thanksgiving": {
      // 4th Thursday of November
      return getNthDayOfMonth(year, 11, 4, 4);
    }

    case "black-friday": {
      // Day after Thanksgiving
      const tg = getNthDayOfMonth(year, 11, 4, 4);
      return { month: tg.month, day: tg.day + 1 };
    }

    case "small-business-saturday": {
      // Saturday after Thanksgiving (2 days after)
      const tgSbs = getNthDayOfMonth(year, 11, 4, 4);
      return { month: tgSbs.month, day: tgSbs.day + 2 };
    }

    case "cyber-monday": {
      // Monday after Thanksgiving (4 days after Thanksgiving)
      const tg2 = getNthDayOfMonth(year, 11, 4, 4);
      const thanksgivingDate = new Date(year, tg2.month - 1, tg2.day);
      const cyberMonday = addDays(thanksgivingDate, 4);
      return {
        month: cyberMonday.getMonth() + 1,
        day: cyberMonday.getDate(),
      };
    }

    case "hanukkah":
      // Hanukkah dates are based on the Hebrew calendar.
      // Using a lookup table for the first night of Hanukkah (approximate).
      return getHanukkahDate(year);

    default:
      // Fallback for unknown computed holidays
      return { month: holiday.month, day: holiday.day };
  }
}

/**
 * Get upcoming holidays within the next N days (default 30), sorted by date.
 */
export function getUpcomingHolidays(
  daysAhead: number = 30
): (Holiday & { date: Date })[] {
  const today = startOfDay(new Date());
  const cutoff = startOfDay(addDays(today, daysAhead));
  const currentYear = today.getFullYear();

  const results: (Holiday & { date: Date })[] = [];

  // Check holidays for current year and next year (to handle year boundaries)
  for (const year of [currentYear, currentYear + 1]) {
    for (const holiday of US_HOLIDAYS) {
      const { month, day } = getHolidayDate(holiday, year);
      const holidayDate = startOfDay(new Date(year, month - 1, day));

      if (
        (isEqual(holidayDate, today) || isAfter(holidayDate, today)) &&
        (isEqual(holidayDate, cutoff) || isBefore(holidayDate, cutoff))
      ) {
        results.push({ ...holiday, date: holidayDate });
      }
    }
  }

  // Sort by date ascending
  results.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Deduplicate (in case a holiday appears in both years within range)
  const seen = new Set<string>();
  return results.filter((h) => {
    const key = `${h.id}-${h.date.getTime()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Find a holiday by its unique ID.
 */
export function getHolidayById(id: string): Holiday | undefined {
  return US_HOLIDAYS.find((h) => h.id === id);
}

/**
 * Find all holidays that fall on a specific date.
 */
export function getHolidaysForDate(
  month: number,
  day: number,
  year: number
): Holiday[] {
  return US_HOLIDAYS.filter((holiday) => {
    const resolved = getHolidayDate(holiday, year);
    return resolved.month === month && resolved.day === day;
  });
}
