// Mint-gel SVG glyph system. 32×32 viewBox, mint-200→mint-500 fill,
// 1.25px everglade stroke. Same API as the legacy PNG sprite.

import React from "react";

function svgFor(inner: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">` +
    `<defs>` +
    `<linearGradient id="g" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#E6FFE8"/>` +
    `<stop offset="1" stop-color="#A7E9BC"/>` +
    `</linearGradient>` +
    `<linearGradient id="r" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#F6F8F7" stop-opacity="0.55"/>` +
    `<stop offset="0.5" stop-color="#F6F8F7" stop-opacity="0"/>` +
    `</linearGradient>` +
    `</defs>` +
    inner +
    `</svg>`;
  return "data:image/svg+xml;utf8," + svg.replace(/#/g, "%23").replace(/"/g, "'");
}

function gel(d: string, accent?: string) {
  const inner =
    `<path d="${d}" fill="url(#g)" stroke="#12221A" stroke-width="1.25" stroke-linejoin="miter" stroke-linecap="square"/>` +
    (accent
      ? `<path d="${accent}" fill="#F6F8F7" fill-opacity="0.45" stroke="none"/>`
      : "");
  return svgFor(inner);
}

const FLAME = gel(
  "M16 3 C 13 8 9 11 9 17 C 9 22 12 27 16 28 C 20 27 23 22 23 17 C 23 13 21 11 19 8 C 18 11 17 12 16 12 C 16 9 17 6 16 3 Z",
  "M16 7 C 14 11 12 13 12 17 C 12 20 14 23 16 23 C 14 20 14 17 15 14 Z",
);

const CROWN = gel(
  "M5 12 L 10 18 L 16 9 L 22 18 L 27 12 L 25 24 L 7 24 Z",
  "M7 14 L 10 18 L 12 16 L 9 14 Z",
);

const ZAP = gel("M18 3 L 7 18 L 14 18 L 12 29 L 25 12 L 17 12 L 20 3 Z", "M16 6 L 11 16 L 14 16 Z");

const STAR = gel(
  "M16 3 L 19.5 12 L 29 13 L 22 19.5 L 24 29 L 16 24 L 8 29 L 10 19.5 L 3 13 L 12.5 12 Z",
  "M16 7 L 17.5 12 L 22 13 L 19 16 Z",
);

const TROPHY = gel(
  "M9 5 L 23 5 L 23 12 C 23 17 20 20 16 20 C 12 20 9 17 9 12 Z M16 20 L 16 25 L 12 28 L 20 28 L 20 25 L 16 25 Z M9 7 L 5 7 L 5 11 L 9 13 Z M23 7 L 27 7 L 27 11 L 23 13 Z",
  "M11 7 L 21 7 L 21 9 L 11 9 Z",
);

const SHIELD = gel(
  "M16 3 L 27 7 L 27 16 C 27 22 22 27 16 29 C 10 27 5 22 5 16 L 5 7 Z",
  "M16 6 L 24 9 L 24 16 C 24 20 20 24 16 25 C 16 18 16 12 16 6 Z",
);

const CHECK = gel(
  "M16 3 C 8 3 3 8 3 16 C 3 24 8 29 16 29 C 24 29 29 24 29 16 C 29 8 24 3 16 3 Z M10 16 L 14 21 L 22 12",
  "M16 6 C 10 6 7 10 7 14 C 9 11 13 9 16 9 C 19 8 22 9 24 11 C 23 8 20 6 16 6 Z",
);

const BADGE = gel(
  "M16 3 L 22 7 L 22 14 L 27 17 L 22 20 L 22 27 L 16 24 L 10 27 L 10 20 L 5 17 L 10 14 L 10 7 Z",
  "M14 8 L 18 8 L 18 11 L 14 11 Z",
);

const LOCK = gel(
  "M10 14 L 10 9 C 10 6 12 4 16 4 C 20 4 22 6 22 9 L 22 14 M7 14 L 25 14 L 25 28 L 7 28 Z",
  "M9 16 L 23 16 L 23 18 L 9 18 Z",
);

const UNLOCK = gel(
  "M10 14 L 10 9 C 10 6 12 4 16 4 C 19 4 21 5 22 8 M7 14 L 25 14 L 25 28 L 7 28 Z",
  "M9 16 L 23 16 L 23 18 L 9 18 Z",
);

const SPARKLES = gel(
  "M16 3 L 18 13 L 28 16 L 18 19 L 16 29 L 14 19 L 4 16 L 14 13 Z M24 4 L 25 8 L 29 9 L 25 10 L 24 14 L 23 10 L 19 9 L 23 8 Z",
);

const HEART = gel(
  "M16 28 C 16 28 4 20 4 12 C 4 8 7 5 11 5 C 14 5 16 7 16 9 C 16 7 18 5 21 5 C 25 5 28 8 28 12 C 28 20 16 28 16 28 Z",
  "M11 8 C 9 8 7 10 7 12 C 7 14 9 17 12 19 C 11 16 11 12 11 8 Z",
);

const THUMB = gel(
  "M5 14 L 9 14 L 9 28 L 5 28 Z M9 14 L 13 5 C 14 4 16 4 17 5 C 18 7 17 10 16 13 L 24 13 C 26 13 28 14 28 16 C 28 18 27 19 26 19 C 27 20 27 22 25 23 C 26 24 26 26 24 27 C 24 28 22 28 21 28 L 12 28 L 9 25 Z",
);

const PEOPLE = gel(
  "M11 11 C 11 8 13 6 16 6 C 19 6 21 8 21 11 C 21 14 19 16 16 16 C 13 16 11 14 11 11 Z M5 28 C 5 22 10 19 16 19 C 22 19 27 22 27 28 Z M3 14 C 3 12 4 11 6 11 C 7 11 8 11 8 12 C 8 11 8 10 8 9 C 9 8 11 8 12 9 M24 9 C 25 8 27 8 28 9 C 28 10 28 11 28 12 C 28 11 29 11 30 11 C 31 11 32 12 32 14",
);

const CHAT = gel(
  "M5 8 C 5 6 7 4 9 4 L 23 4 C 25 4 27 6 27 8 L 27 18 C 27 20 25 22 23 22 L 14 22 L 9 28 L 9 22 C 7 22 5 20 5 18 Z",
  "M9 9 L 23 9 L 23 11 L 9 11 Z M9 13 L 19 13 L 19 15 L 9 15 Z",
);

const GIFT = gel(
  "M5 12 L 27 12 L 27 16 L 5 16 Z M7 16 L 25 16 L 25 28 L 7 28 Z M16 12 L 16 28 M9 12 C 6 9 9 5 12 7 C 14 8 16 12 16 12 C 16 12 18 8 20 7 C 23 5 26 9 23 12",
  "M9 14 L 23 14 L 23 15 L 9 15 Z",
);

const DROP = gel(
  "M16 3 C 12 9 7 15 7 21 C 7 26 11 29 16 29 C 21 29 25 26 25 21 C 25 15 20 9 16 3 Z",
  "M16 8 C 13 12 11 16 11 20 C 13 16 15 13 16 10 Z",
);

const PACKAGE = gel(
  "M16 4 L 28 10 L 28 23 L 16 29 L 4 23 L 4 10 Z M4 10 L 16 16 L 28 10 M16 16 L 16 29 M10 7 L 22 13",
  "M5 11 L 16 17 L 16 18 L 5 12 Z",
);

const TICKET = gel(
  "M4 9 L 28 9 C 28 11 30 13 30 15 C 28 15 28 17 28 19 L 28 23 L 4 23 L 4 19 C 4 17 2 17 2 15 C 2 13 4 11 4 9 Z M14 9 L 14 23 M18 11 L 18 13 M18 15 L 18 17 M18 19 L 18 21",
);

const CINEMA = gel(
  "M3 11 L 29 9 L 29 13 L 3 15 Z M5 13 L 27 13 L 27 28 L 5 28 Z M7 9 L 9 13 M11 9 L 13 13 M15 9 L 17 13 M19 9 L 21 13 M23 9 L 25 13",
);

const VIP = gel(
  "M16 3 L 28 12 L 16 29 L 4 12 Z M11 12 L 21 12 M16 3 L 11 12 L 16 29 L 21 12 Z",
  "M14 6 L 18 6 L 19 11 L 13 11 Z",
);

const CLOCK = gel(
  "M16 3 C 9 3 3 9 3 16 C 3 23 9 29 16 29 C 23 29 29 23 29 16 C 29 9 23 3 16 3 Z M16 8 L 16 16 L 22 19",
  "M16 6 C 11 6 8 9 7 13 C 11 8 21 8 25 13 C 24 9 21 6 16 6 Z",
);

const CALENDAR = gel(
  "M5 8 L 27 8 L 27 28 L 5 28 Z M5 14 L 27 14 M10 5 L 10 11 M22 5 L 22 11 M11 18 L 13 18 M16 18 L 18 18 M21 18 L 23 18 M11 23 L 13 23 M16 23 L 18 23",
);

const HOME = gel(
  "M5 14 L 16 4 L 27 14 L 27 28 L 19 28 L 19 19 L 13 19 L 13 28 L 5 28 Z",
  "M8 15 L 16 8 L 24 15 L 24 17 L 16 11 L 8 17 Z",
);

const BUILDING = gel(
  "M7 4 L 25 4 L 25 28 L 7 28 Z M11 8 L 13 8 M15 8 L 17 8 M19 8 L 21 8 M11 13 L 13 13 M15 13 L 17 13 M19 13 L 21 13 M11 18 L 13 18 M15 18 L 17 18 M19 18 L 21 18 M14 22 L 18 22 L 18 28 L 14 28 Z",
);

const LOCATION = gel(
  "M16 3 C 10 3 6 7 6 13 C 6 20 16 29 16 29 C 16 29 26 20 26 13 C 26 7 22 3 16 3 Z M16 9 C 18 9 20 11 20 13 C 20 15 18 17 16 17 C 14 17 12 15 12 13 C 12 11 14 9 16 9 Z",
);

const MAP = gel(
  "M3 7 L 11 5 L 21 7 L 29 5 L 29 25 L 21 27 L 11 25 L 3 27 Z M11 5 L 11 25 M21 7 L 21 27",
);

const DOCUMENT = gel(
  "M7 4 L 19 4 L 25 10 L 25 28 L 7 28 Z M19 4 L 19 10 L 25 10 M11 14 L 21 14 M11 18 L 21 18 M11 22 L 17 22",
);

const FOLDER = gel(
  "M3 9 L 12 9 L 14 12 L 29 12 L 29 26 L 3 26 Z",
  "M5 13 L 27 13 L 27 14 L 5 14 Z",
);

const MONEY = gel(
  "M16 3 C 9 3 3 9 3 16 C 3 23 9 29 16 29 C 23 29 29 23 29 16 C 29 9 23 3 16 3 Z M19 11 C 18 9 14 9 13 11 C 12 13 13 14 16 15 C 19 16 20 17 19 19 C 18 21 14 21 13 19 M16 8 L 16 22",
);

const WALLET = gel(
  "M5 9 L 27 9 L 27 25 L 5 25 Z M5 9 L 5 7 L 23 7 L 23 9 M22 16 C 22 14 24 14 25 14 L 27 14 L 27 19 L 25 19 C 24 19 22 19 22 17 Z",
);

const PLUS = gel(
  "M16 3 C 9 3 3 9 3 16 C 3 23 9 29 16 29 C 23 29 29 23 29 16 C 29 9 23 3 16 3 Z M16 9 L 16 23 M9 16 L 23 16",
);

const MINUS = gel(
  "M16 3 C 9 3 3 9 3 16 C 3 23 9 29 16 29 C 23 29 29 23 29 16 C 29 9 23 3 16 3 Z M9 16 L 23 16",
);

const SETTINGS = gel(
  "M16 11 C 13 11 11 13 11 16 C 11 19 13 21 16 21 C 19 21 21 19 21 16 C 21 13 19 11 16 11 Z M14 4 L 18 4 L 19 8 L 22 9 L 25 7 L 28 10 L 26 13 L 27 16 L 27 16 L 26 19 L 28 22 L 25 25 L 22 23 L 19 24 L 18 28 L 14 28 L 13 24 L 10 23 L 7 25 L 4 22 L 6 19 L 5 16 L 6 13 L 4 10 L 7 7 L 10 9 L 13 8 Z",
);

const USER = gel(
  "M16 4 C 12 4 9 7 9 11 C 9 15 12 18 16 18 C 20 18 23 15 23 11 C 23 7 20 4 16 4 Z M5 28 C 5 22 10 19 16 19 C 22 19 27 22 27 28 Z",
);

const BELL = gel(
  "M16 4 C 12 4 9 7 9 11 L 9 18 L 6 22 L 26 22 L 23 18 L 23 11 C 23 7 20 4 16 4 Z M13 25 C 13 27 14 28 16 28 C 18 28 19 27 19 25 Z",
);

const MENU = gel("M5 9 L 27 9 M5 16 L 27 16 M5 23 L 27 23");

const ENERGY = gel(
  "M9 3 L 23 3 L 23 9 L 27 9 L 27 23 L 23 23 L 23 29 L 9 29 L 9 23 L 5 23 L 5 9 L 9 9 Z M16 8 L 16 24 M11 12 L 21 12 M11 20 L 21 20",
);

const KETTLE = gel(
  "M11 6 L 21 6 L 23 11 L 23 24 C 23 27 21 28 19 28 L 13 28 C 11 28 9 27 9 24 L 9 11 Z M14 9 L 18 9",
);

const WATER = gel(
  "M11 4 L 21 4 L 21 7 L 19 8 L 19 28 L 13 28 L 13 8 L 11 7 Z M14 12 L 18 12 M14 18 L 18 18 M14 24 L 18 24",
);

const VITAMINS = gel(
  "M9 11 C 9 8 11 6 14 6 L 18 6 C 21 6 23 8 23 11 L 23 21 C 23 24 21 26 18 26 L 14 26 C 11 26 9 24 9 21 Z M9 16 L 23 16",
);

const EGG = gel(
  "M16 3 C 11 3 7 11 7 19 C 7 25 11 29 16 29 C 21 29 25 25 25 19 C 25 11 21 3 16 3 Z",
);

const BROCCOLI = gel(
  "M16 4 C 12 4 9 7 9 11 C 7 11 5 13 5 16 C 5 18 6 20 8 21 L 14 28 L 18 28 L 24 21 C 26 20 27 18 27 16 C 27 13 25 11 23 11 C 23 7 20 4 16 4 Z",
);

const QR = gel(
  "M5 5 L 12 5 L 12 12 L 5 12 Z M20 5 L 27 5 L 27 12 L 20 12 Z M5 20 L 12 20 L 12 27 L 5 27 Z M16 16 L 20 16 L 20 20 L 16 20 Z M22 16 L 27 16 L 27 20 L 22 20 Z M16 22 L 18 22 L 18 27 L 16 27 Z M22 24 L 27 24 L 27 27 L 22 27 Z",
);

const CARD = gel(
  "M3 8 L 29 8 L 29 24 L 3 24 Z M3 12 L 29 12 M7 18 L 13 18 M7 21 L 11 21 M21 18 L 25 21",
);

const ORB = gel(
  "M16 3 C 9 3 3 9 3 16 C 3 23 9 29 16 29 C 23 29 29 23 29 16 C 29 9 23 3 16 3 Z M16 8 C 11 8 8 11 8 16 C 8 21 11 24 16 24",
);

const SIGNAL = gel(
  "M5 24 L 9 24 L 9 20 L 5 20 Z M11 24 L 15 24 L 15 16 L 11 16 Z M17 24 L 21 24 L 21 11 L 17 11 Z M23 24 L 27 24 L 27 6 L 23 6 Z",
);

const HEAT = gel(
  "M16 3 C 13 8 9 11 9 17 C 9 22 12 27 16 28 C 20 27 23 22 23 17 C 23 13 21 11 19 8 C 18 11 17 12 16 12 C 16 9 17 6 16 3 Z M16 14 C 14 17 13 19 13 21 C 13 23 14 25 16 25 C 18 25 19 23 19 21 C 19 19 18 17 16 14 Z",
);

const CRED = TROPHY;
const STREAK = FLAME;
const FIRE = FLAME;
const MEDAL = BADGE;
const PREMIUM = VIP;
const VAULT = SHIELD;
const VERIFIED = CHECK;
const ENC = CHECK;
const ESCALATE = ZAP;
const CARD_GLYPH = CARD;
const COMMUNITY = PEOPLE;
const USERS = PEOPLE;
const ENERGY_DRINK = ENERGY;
const FULL_ENERGY = ENERGY;
const BURN_CALORIES = FLAME;
const DUMBBELL = KETTLE;
const GYM = KETTLE;
const GIVEAWAY = GIFT;

export const Icons3D = {
  // Energy / streak family
  fire: "/icons3d/flame.png",
  streak: "/icons3d/flame.png",
  flame: "/icons3d/flame.png",
  energy: FULL_ENERGY,
  burnCalories: "/icons3d/flame.png",
  energyDrink: ENERGY_DRINK,

  // Fitness
  dumbbell: DUMBBELL,
  gym: GYM,
  kettlebell: KETTLE,
  water: WATER,
  vitamins: VITAMINS,
  egg: EGG,
  broccoli: BROCCOLI,

  // Drops / gifts
  gift: GIFT,
  drop: DROP,
  giveaway: GIVEAWAY,
  package: PACKAGE,

  // Status
  crown: "/icons3d/crown.png",
  trophy: "/icons3d/trophy.png",
  star: "/icons3d/star.png",
  medal: "/icons3d/star-badge-ribbon.png",
  vip: "/icons3d/crown.png",
  premium: "/icons3d/crown.png",

  // Auth / vault
  shield: "/icons3d/verified-shield.png",
  verified: "/icons3d/document-check.png",
  badge: "/icons3d/star-badge-ribbon.png",
  lock: "/icons3d/verified-shield.png",
  unlock: "/icons3d/eye-scanner.png",
  check: "/icons3d/document-check.png",

  // Action / energy
  zap: ZAP,
  sparkles: SPARKLES,
  heart: "/icons3d/loved.png",
  thumbsUp: THUMB,
  community: COMMUNITY,
  users: USERS,
  chat: CHAT,

  // Time / events
  clock: CLOCK,
  calendar: CALENDAR,
  ticket: TICKET,
  cinema: CINEMA,

  // Place
  home: HOME,
  building: BUILDING,
  location: LOCATION,
  map: MAP,

  // Documents / money
  document: DOCUMENT,
  folder: FOLDER,
  money: MONEY,
  wallet: WALLET,

  // Compact UI
  plus: PLUS,
  minus: MINUS,
  settings: SETTINGS,
  user: "/icons3d/verified-user.png",
  bell: BELL,
  menu: MENU,

  // Semantic nav aliases — these only have meaning via PNG override and
  // fall back to the closest SVG glyph if the PNG is missing.
  brain: ORB,
  signal: SIGNAL,
  satellite: SIGNAL,
  vault: SHIELD,
  eyeScanner: SHIELD,
  rocket: ZAP,
  goals: TROPHY,
  podium: TROPHY,
  globe: ORB,
  warn: SHIELD,
  phone: USER,
  twoFactor: SHIELD,
  pulse: ZAP,
} as const;

export const IconCatalog = {
  named: Object.fromEntries(
    Object.entries(Icons3D).map(([k, v]) => [
      k,
      { src: v, name: k, category: "glyph" },
    ]),
  ),
  batchA: [GIFT, DROP, GIVEAWAY, PACKAGE, STAR, BADGE, MEDAL, VIP],
  batchB: [CROWN, TROPHY, STAR, MEDAL, VIP, PREMIUM],
  batchC: [CLOCK, CALENDAR, TICKET, CINEMA],
  batchD: [BADGE, LOCK, UNLOCK, VERIFIED, SHIELD, CHECK],
  batchE: [ZAP, SPARKLES, HEART, THUMB, PEOPLE, CHAT],
  batchF: [PLUS, MINUS, SETTINGS, USER, BELL, MENU],
  batchG: [HOME, BUILDING, LOCATION, MAP],
};

// Premium 3D PNG registry — single source of truth for the "to use for app"
// asset pack synced from Object Storage. Filenames mirror the slugified
// originals in client/public/icons3d/. Keep this list in sync with
// mobile/src/lib/icons3d.ts.
export const PNG_REGISTRY = {
  // Core nav / status
  flame: "/icons3d/flame.png",
  fire: "/icons3d/flame.png",
  streak: "/icons3d/flame.png",
  burnCalories: "/icons3d/burn-calories.png",
  crown: "/icons3d/crown.png",
  trophy: "/icons3d/trophy.png",
  starTrophy: "/icons3d/star-trophy.png",
  starPodium: "/icons3d/star-podium.png",
  starPyramid: "/icons3d/star-pyramid.png",
  starReview: "/icons3d/star-review.png",
  starScanner: "/icons3d/star-scanner.png",
  starBadgeRibbon: "/icons3d/star-badge-ribbon.png",
  bolt: "/icons3d/bolt.png",
  star: "/icons3d/star.png",
  money: "/icons3d/money.png",
  moneyBags: "/icons3d/money-bags.png",
  dollarBill: "/icons3d/dollar-bill.png",
  salary: "/icons3d/salary.png",

  // Fitness / wellness
  egg: "/icons3d/egg.png",
  gym: "/icons3d/gym.png",
  gymDay: "/icons3d/gym-day.png",
  handGrips: "/icons3d/hand-grips.png",
  jogging: "/icons3d/jogging.png",
  jumpingRope: "/icons3d/jumping-rope.png",
  tennis: "/icons3d/tennis.png",
  vitamins: "/icons3d/vitamins.png",
  milk: "/icons3d/milk.png",
  dietFood: "/icons3d/diet-food.png",
  noSugar: "/icons3d/no-sugar.png",
  vaccine: "/icons3d/vaccine.png",
  growthPlant: "/icons3d/growth-plant.png",
  lifePreserver: "/icons3d/life-preserver.png",

  // Time / schedule
  calendar: "/icons3d/calendar.png",
  scheduleAlert: "/icons3d/schedule-alert.png",
  alarmClockCheck: "/icons3d/alarm-clock-check.png",
  attendance: "/icons3d/attendance.png",
  bell: "/icons3d/schedule-alert.png",

  // Drops / gifts / giveaways
  gift: "/icons3d/giveaway-gift.png",
  giveaway: "/icons3d/giveaway-gift.png",
  giveawayBox: "/icons3d/giveaway-box.png",
  giveawayBoxes: "/icons3d/giveaway-boxes.png",
  giveawayYellow: "/icons3d/giveaway-yellow-box.png",
  giveawayBanner: "/icons3d/giveaway-banner.png",
  giveawayBalloons: "/icons3d/giveaway-balloons-banner.png",
  giveawayText: "/icons3d/giveaway-text.png",
  giveawayMegaphone: "/icons3d/megaphone-giveaway.png",
  giveawayHeart: "/icons3d/heart-giveaway.png",
  giveawayTwo: "/icons3d/two-gifts-giveaway.png",
  openGiftBox: "/icons3d/open-gift-box.png",
  openPinkGift: "/icons3d/open-pink-gift.png",
  openRedGift: "/icons3d/open-red-gift.png",
  redGiftBox: "/icons3d/red-gift-box.png",
  wrappedRedGift: "/icons3d/wrapped-red-gift.png",
  balloonGiftBox: "/icons3d/balloon-gift-box.png",
  yellowGiftBurst: "/icons3d/yellow-gift-burst.png",
  giftBasket: "/icons3d/gift-basket.png",
  phoneHeartGift: "/icons3d/phone-heart-gift.png",

  // Energy / signal
  energy: "/icons3d/full-energy.png",
  energyDrink: "/icons3d/energy-drink.png",
  greenEnergy: "/icons3d/green-energy.png",
  earthEnergy: "/icons3d/earth-energy.png",
  earthGlobe: "/icons3d/earth-globe.png",
  earthOnFire: "/icons3d/earth-on-fire.png",

  // Tech / network / AI
  brain: "/icons3d/brain.png",
  robot: "/icons3d/robot.png",
  humanoidRobot: "/icons3d/humanoid-robot.png",
  roboticHand: "/icons3d/robotic-hand.png",
  rocket: "/icons3d/rocket.png",
  toyRocket: "/icons3d/toy-rocket.png",
  astronaut: "/icons3d/astronaut.png",
  satellite: "/icons3d/satellite.png",
  antenna: "/icons3d/antenna.png",
  wifi: "/icons3d/wifi.png",
  liveWifi: "/icons3d/live-wifi.png",
  wifiPassword: "/icons3d/wifi-password.png",
  wifiRouter: "/icons3d/wifi-router.png",
  wifiSetting: "/icons3d/wifi-setting.png",
  internet: "/icons3d/internet.png",
  neuralNetwork: "/icons3d/neural-network.png",
  neuralink: "/icons3d/neuralink.png",
  aiChip: "/icons3d/ai-chip.png",
  aiChatBubbles: "/icons3d/ai-chat-bubbles.png",
  aiCustomerService: "/icons3d/ai-customer-service.png",
  automationTesting: "/icons3d/automation-testing.png",

  // Verified / auth / vault
  verifiedShield: "/icons3d/verified-shield.png",
  verifiedClick: "/icons3d/verified-click.png",
  verifiedHand: "/icons3d/verified-hand.png",
  verifiedRibbon: "/icons3d/verified-ribbon.png",
  verifiedSearch: "/icons3d/verified-search.png",
  verifiedUser: "/icons3d/verified-user.png",
  verifiedWallet: "/icons3d/verified-wallet.png",
  approvedPhone: "/icons3d/approved-phone.png",
  approvedStamp: "/icons3d/approved-stamp.png",
  certificate: "/icons3d/certificate.png",
  documentCheck: "/icons3d/document-check.png",
  signedDocument: "/icons3d/signed-document.png",
  pen: "/icons3d/pen.png",
  notComplete: "/icons3d/not-complete.png",
  eyeScanner: "/icons3d/eye-scanner.png",
  nametag: "/icons3d/nametag.png",

  // Career / growth / business
  goals: "/icons3d/goals.png",
  goalSign: "/icons3d/goal-sign.png",
  globalCareer: "/icons3d/global-career.png",
  negotiation: "/icons3d/negotiation.png",
  networking: "/icons3d/networking.png",
  riskInvestment: "/icons3d/risk-investment.png",
  mountainFlag: "/icons3d/mountain-flag.png",
  crossedFlags: "/icons3d/crossed-flags.png",
  shoppingBag: "/icons3d/shopping-bag.png",

  // Celebration
  confettiBall: "/icons3d/confetti-ball.png",
  confettiBurst: "/icons3d/confetti-burst.png",
  confettiCup: "/icons3d/confetti-cup.png",
  confettiPopper: "/icons3d/confetti-popper.png",
  partyCone: "/icons3d/party-cone.png",
  partyPopper: "/icons3d/party-popper.png",
  kissMark: "/icons3d/kiss-mark.png",

  // Emotional / face set (for emotional-attunement surfaces)
  faceHappy: "/icons3d/happy-face.png",
  faceSad: "/icons3d/sad-face.png",
  faceFear: "/icons3d/fear-face.png",
  faceAnxiety: "/icons3d/anxiety-face.png",
  faceLoved: "/icons3d/loved-face.png",
  loved: "/icons3d/loved.png",
  faceHello: "/icons3d/hello-emoji.png",
  faceSmiling: "/icons3d/smiling-face-emoji.png",
  faceLaughing: "/icons3d/laughing-emoji.png",
  faceLaughTears: "/icons3d/laughter-tears-emoji.png",
  faceKissing: "/icons3d/kissing-emoji.png",
  faceBlowingKiss: "/icons3d/blowing-kiss-emoji.png",
  faceEnamored: "/icons3d/enamored-emoji.png",
  faceMoneyMouth: "/icons3d/money-mouth-emoji.png",
  facePhotoSmile: "/icons3d/photo-smile-emoji.png",
  faceAlien: "/icons3d/alien-emoji.png",
  faceDevil: "/icons3d/devil-emoji.png",
  faceNinja: "/icons3d/ninja-emoji.png",
  facePirate: "/icons3d/pirate-emoji.png",
  faceMustache: "/icons3d/mustache-emoji.png",
  faceMonocle: "/icons3d/monocle-emoji.png",
  faceGlasses: "/icons3d/glasses-emoji.png",
  faceNerd: "/icons3d/nerd-emoji.png",
  faceAwkward: "/icons3d/awkward-face-emoji.png",
  faceBoredom: "/icons3d/boredom-emoji.png",
  faceDisappointed: "/icons3d/disappointed-emoji.png",
  faceEmbarrassment: "/icons3d/embarrassment-emoji.png",
  faceGrimacing: "/icons3d/grimacing-emoji.png",
  faceNausea: "/icons3d/nausea-emoji.png",
  facePain: "/icons3d/pain-emoji.png",
  facePuke: "/icons3d/puke-emoji.png",
  faceQuiet: "/icons3d/quiet-emoji.png",
  faceReactionless: "/icons3d/reactionless-emoji.png",
  faceRegret: "/icons3d/regret-emoji.png",
  faceSickMask: "/icons3d/sick-mask-emoji.png",
  faceNaughty: "/icons3d/naughty-emoji.png",
  faceBloodEyes: "/icons3d/blood-eyes-emoji.png",
  faceNoComments: "/icons3d/no-comments-emoji.png",
} as const;

// Subset of registry keys that override an existing Icons3D glyph entry.
// Anything in PNG_REGISTRY that is not already a glyph key (e.g. faceHappy,
// astronaut, neuralink) is still consumable via Icon3DAsset by key.
const PNG_OVERRIDES: Partial<Record<keyof typeof Icons3D, string>> = {
  fire: PNG_REGISTRY.flame,
  heart: PNG_REGISTRY.loved,
  community: PNG_REGISTRY.verifiedUser,
  users: PNG_REGISTRY.verifiedUser,
  streak: PNG_REGISTRY.flame,
  flame: PNG_REGISTRY.flame,
  burnCalories: PNG_REGISTRY.burnCalories,
  crown: PNG_REGISTRY.crown,
  trophy: PNG_REGISTRY.trophy,
  medal: PNG_REGISTRY.starBadgeRibbon,
  zap: PNG_REGISTRY.bolt,
  star: PNG_REGISTRY.star,
  money: PNG_REGISTRY.money,
  wallet: PNG_REGISTRY.verifiedWallet,
  egg: PNG_REGISTRY.egg,
  gym: PNG_REGISTRY.gymDay,
  dumbbell: PNG_REGISTRY.handGrips,
  kettlebell: PNG_REGISTRY.handGrips,
  vitamins: PNG_REGISTRY.vitamins,
  calendar: PNG_REGISTRY.calendar,
  bell: PNG_REGISTRY.scheduleAlert,
  clock: PNG_REGISTRY.alarmClockCheck,
  gift: PNG_REGISTRY.gift,
  // DROP = exclusive intel burst (Night Shift), not a wrapped present.
  drop: PNG_REGISTRY.yellowGiftBurst,
  giveaway: PNG_REGISTRY.giveaway,
  package: PNG_REGISTRY.shoppingBag,
  shield: PNG_REGISTRY.verifiedShield,
  verified: PNG_REGISTRY.verifiedClick,
  badge: PNG_REGISTRY.starBadgeRibbon,
  check: PNG_REGISTRY.documentCheck,
  document: PNG_REGISTRY.signedDocument,
  energy: PNG_REGISTRY.energy,
  energyDrink: PNG_REGISTRY.energyDrink,
  sparkles: PNG_REGISTRY.confettiBurst,
  // heart intentionally left to the mint-gel SVG fallback so it reads as
  // "love / like" instead of a wrapped heart-shaped gift.
  user: PNG_REGISTRY.verifiedUser,
  unlock: PNG_REGISTRY.eyeScanner,
  lock: PNG_REGISTRY.verifiedShield,

  ticket: PNG_REGISTRY.verifiedRibbon,
  warn: PNG_REGISTRY.notComplete,
  phone: PNG_REGISTRY.approvedPhone,
  twoFactor: PNG_REGISTRY.approvedPhone,
  mail: PNG_REGISTRY.approvedPhone,
  pulse: PNG_REGISTRY.brain,
  watchers: PNG_REGISTRY.eyeScanner,
  trendUp: PNG_REGISTRY.rocket,
  trendDown: PNG_REGISTRY.notComplete,
  opportunity: PNG_REGISTRY.rocket,
  access: PNG_REGISTRY.eyeScanner,
  intel: PNG_REGISTRY.brain,
  connection: PNG_REGISTRY.verifiedUser,
  housing: PNG_REGISTRY.balloonGiftBox,
  employment: PNG_REGISTRY.salary,
  food: PNG_REGISTRY.dietFood,
  health: PNG_REGISTRY.vaccine,
  financial: PNG_REGISTRY.moneyBags,
  education: PNG_REGISTRY.brain,

  // Semantic nav PNGs
  brain: PNG_REGISTRY.brain,
  signal: PNG_REGISTRY.antenna,
  satellite: PNG_REGISTRY.satellite,
  vault: PNG_REGISTRY.eyeScanner,
  eyeScanner: PNG_REGISTRY.eyeScanner,
  rocket: PNG_REGISTRY.rocket,
  goals: PNG_REGISTRY.goals,
  podium: PNG_REGISTRY.starPodium,
  globe: PNG_REGISTRY.earthGlobe,
};

export interface Icon3DProps {
  icon: keyof typeof Icons3D;
  size?: number;
  className?: string;
  animate?: boolean;
}

export function Icon3DImage({
  icon,
  size = 48,
  className = "",
  animate = false,
  milspec = false,
}: Icon3DProps & { milspec?: boolean }) {
  const src = PNG_OVERRIDES[icon] ?? Icons3D[icon];
  const dropShadow =
    "drop-shadow(0 1px 0 rgba(255,255,255,0.10)) drop-shadow(0 2px 4px rgba(0,0,0,0.55))";
  return (
    <img
      src={src}
      alt={icon}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: milspec ? `contrast(1.08) ${dropShadow}` : dropShadow,
        ...(animate && { animation: "pulse 2s ease-in-out infinite" }),
      }}
    />
  );
}

// Direct exports preserved for legacy named-import callsites.
export const fireIcon = FIRE;
export const fullEnergyIcon = FULL_ENERGY;
export const burnCaloriesIcon = BURN_CALORIES;
export const giftIcon = GIFT;
export const dropIcon = DROP;
export const crownIcon = CROWN;
export const trophyIcon = TROPHY;
export const starIcon = STAR;
export const shieldIcon = SHIELD;
export const verifiedIcon = VERIFIED;
export const checkIcon = CHECK;
export const zapIcon = ZAP;
export const sparklesIcon = SPARKLES;

// MilspecIcon — locked Direction-D glyph set.
export const DGlyphs = {
  orb: ORB,
  signal: SIGNAL,
  drop: DROP,
  card: CARD_GLYPH,
  qr: QR,
  vault: VAULT,
  heat: HEAT,
  cred: CRED,
  streak: STREAK,
  member: CROWN,
  enc: ENC,
  escalate: ESCALATE,
} as const;

export type DGlyph = keyof typeof DGlyphs;

interface MilspecIconProps {
  icon: DGlyph;
  size?: number;
  className?: string;
}

export function MilspecIcon({ icon, size = 20, className = "" }: MilspecIconProps) {
  const src = DGlyphs[icon];
  return (
    <img
      src={src}
      alt={icon}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter:
          "contrast(1.08) drop-shadow(0 1px 0 rgba(255,255,255,0.10)) drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
      }}
    />
  );
}
