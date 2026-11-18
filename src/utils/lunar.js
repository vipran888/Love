/**
 * 农历工具库（1900-2100）
 *
 * 用途：把「农历月-日」换算成每年对应的公历日期，用于纪念日/生日倒计时。
 *
 * 约定：日期字符串 `1998-10-11` 或 `10-11` 都表示 **农历十月十一**，
 *      年份仅用于计算周年数，不影响月日解释。
 */

// 1900-2100 年农历数据（每年 1 个十六进制数，编码闰月/大小月信息）
const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
  0x0d520,
];

const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;
const DAY_MS = 86400000;
const BASE_UTC = Date.UTC(1900, 0, 31);

/** 某年闰哪个月，0 表示无闰月 */
function leapMonth(y) {
  return lunarInfo[y - FIRST_YEAR] & 0xf;
}

/** 某年闰月的天数，0 表示无闰月 */
function leapDays(y) {
  if (leapMonth(y)) {
    return lunarInfo[y - FIRST_YEAR] & 0x10000 ? 30 : 29;
  }
  return 0;
}

/** 某年某月（非闰月）的天数 */
function monthDays(y, m) {
  return lunarInfo[y - FIRST_YEAR] & (0x10000 >> m) ? 30 : 29;
}

/** 某年总天数（含闰月） */
function yearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += lunarInfo[y - FIRST_YEAR] & i ? 1 : 0;
  }
  return sum + leapDays(y);
}

/**
 * 公历转农历
 * @param {number} y 公历年
 * @param {number} m 公历月 1-12
 * @param {number} d 公历日 1-31
 * @returns {{year:number, month:number, day:number, isLeap:boolean}}
 */
export function solarToLunar(y, m, d) {
  let offset = Math.floor((Date.UTC(y, m - 1, d) - BASE_UTC) / DAY_MS);
  let temp = 0;
  let i;

  for (i = FIRST_YEAR; i <= LAST_YEAR && offset > 0; i++) {
    temp = yearDays(i);
    offset -= temp;
  }
  if (offset < 0) {
    offset += temp;
    i--;
  }
  const year = i;

  const leap = leapMonth(year);
  let isLeap = false;
  let month = 1;
  let lastTemp = 0;

  for (i = 1; i < 13 && offset > 0; i++) {
    let t;
    if (leap > 0 && i === leap + 1 && !isLeap) {
      --i;
      isLeap = true;
      t = leapDays(year);
    } else {
      t = monthDays(year, i);
    }
    if (isLeap && i === leap + 1) isLeap = false;
    offset -= t;
    lastTemp = t;
  }

  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) {
      isLeap = false;
    } else {
      isLeap = true;
      --i;
    }
  }
  if (offset < 0) {
    offset += lastTemp;
    --i;
  }

  month = i;
  const day = offset + 1;
  return { year, month, day, isLeap };
}

/**
 * 农历转公历
 * @param {number} y 农历年
 * @param {number} m 农历月 1-12
 * @param {number} d 农历日 1-30
 * @param {boolean} [isLeap=false] 是否闰月
 * @returns {{year:number, month:number, day:number}}
 */
export function lunarToSolar(y, m, d, isLeap = false) {
  let offset = 0;
  for (let i = FIRST_YEAR; i < y; i++) {
    offset += yearDays(i);
  }

  const leap = leapMonth(y);
  for (let i = 1; i < m; i++) {
    if (leap > 0 && i === leap + 1) offset += leapDays(y);
    offset += monthDays(y, i);
  }
  if (isLeap && leap === m) offset += monthDays(y, m);
  offset += d - 1;

  const t = new Date(BASE_UTC + offset * DAY_MS);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/**
 * 解析日期字符串为农历月日
 * 支持 `10-11`、`1998-10-11`（取最后两段作为农历月日）
 * @returns {{month:number, day:number}|null}
 */
export function parseLunarDate(str) {
  if (!str) return null;
  const parts = String(str)
    .trim()
    .split('-')
    .filter((s) => s !== '');
  if (parts.length < 2) return null;

  const day = Number(parts[parts.length - 1]);
  const month = Number(parts[parts.length - 2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  return { month, day };
}

/**
 * 取下一次「农历月-日」对应的公历 Date
 * 若今年该农历日期已过，则取下一农历年
 * @param {number} month 农历月 1-12
 * @param {number} day 农历日 1-30
 * @param {Date} [today]
 * @returns {Date}
 */
export function getNextLunarOccurrence(month, day, today = new Date()) {
  const todayLunar = solarToLunar(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // 同农历年：目标日已过则跳到下一年
  const passed =
    todayLunar.month > month || (todayLunar.month === month && todayLunar.day > day);

  const tryYear = passed ? todayLunar.year + 1 : todayLunar.year;
  const s = lunarToSolar(tryYear, month, day, false);
  return new Date(s.year, s.month - 1, s.day);
}

/**
 * 距离下一次「农历月-日」还有多少天（当天返回 0）
 * @returns {number}
 */
export function daysUntilLunar(month, day, today = new Date()) {
  const target = getNextLunarOccurrence(month, day, today);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * 计算农历周年数（已满几周年）
 * 例：`2015-03-03` 表示农历三月初三结婚，今天已满 N 周年
 * @param {string} startDateStr 起始日期（年份用于计年，月日按农历解释）
 * @param {Date} [today]
 * @returns {number|null}
 */
export function lunarAnniversaryYears(startDateStr, today = new Date()) {
  const parsed = parseLunarDate(startDateStr);
  if (!parsed) return null;

  const parts = String(startDateStr)
    .trim()
    .split('-')
    .filter((s) => s !== '');
  const startYear = parts.length >= 3 ? Number(parts[0]) : null;

  const todayLunar = solarToLunar(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const passedThisYear =
    todayLunar.month > parsed.month ||
    (todayLunar.month === parsed.month && todayLunar.day >= parsed.day);

  const effectiveYear = passedThisYear ? todayLunar.year : todayLunar.year - 1;

  if (startYear && Number.isFinite(startYear)) {
    return Math.max(0, effectiveYear - startYear);
  }
  return null;
}

/** 农历日期中文表示，如「十月十一」 */
export function lunarDayName(month, day) {
  const mNames = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const dNames = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
  ];
  if (month < 1 || month > 12 || day < 1 || day > 30) return '';
  return `${mNames[month - 1]}月${dNames[day - 1]}`;
}
