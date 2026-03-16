// src/lib/nepali.js
// Nepali (Bikram Sambat) <-> AD converter
// Uses nepali-date-converter for full modern date coverage

import NepaliDate from 'nepali-date-converter';

const BS_MONTHS = ['बैशाख','जेठ','असार','श्रावण','भाद्र','आश्विन','कार्तिक','मंसिर','पुष','माघ','फाल्गुन','चैत्र'];
const BS_MONTHS_EN = ['Baishakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
const NP_DAYS = ['आइतबार','सोमबार','मंगलबार','बुधबार','बिहीबार','शुक्रबार','शनिबार'];
const NP_NUMS = ['०','१','२','३','४','५','६','७','८','९'];

export function adToBS(adDate) {
  try {
    const date = new Date(adDate);
    date.setHours(0, 0, 0, 0);
    const bs = new NepaliDate(date);
    return { year: bs.getYear(), month: bs.getMonth(), day: bs.getDate() };
  } catch {
    return null;
  }
}

export function bsToAD(bsYear, bsMonth, bsDay) {
  try {
    return new NepaliDate(bsYear, bsMonth, bsDay).toJsDate();
  } catch {
    return null;
  }
}

export function formatBSDate(adDateStr) {
  const d = new Date(adDateStr + 'T00:00:00');
  const bs = adToBS(d);
  if (!bs) return '';
  return `${toNepaliNum(bs.day)} ${BS_MONTHS[bs.month]}, ${toNepaliNum(bs.year)}`;
}

export function formatBSDateEn(adDateStr) {
  const d = new Date(adDateStr + 'T00:00:00');
  const bs = adToBS(d);
  if (!bs) return '';
  return `${bs.day} ${BS_MONTHS_EN[bs.month]} ${bs.year} BS`;
}

function toNepaliNum(num) {
  return String(num).split('').map(d => NP_NUMS[+d] || d).join('');
}

export function getBSMonthDays(bsYear, bsMonth) {
  const start = bsToAD(bsYear, bsMonth, 1);
  if (!start) return 30;

  const next = bsMonth === 11
    ? bsToAD(bsYear + 1, 0, 1)
    : bsToAD(bsYear, bsMonth + 1, 1);

  if (!next) return 30;

  const startAtMidnight = new Date(start);
  const nextAtMidnight = new Date(next);
  startAtMidnight.setHours(0, 0, 0, 0);
  nextAtMidnight.setHours(0, 0, 0, 0);

  return Math.round((nextAtMidnight - startAtMidnight) / 86400000);
}

export function getCurrentBS() {
  return adToBS(new Date());
}

export { BS_MONTHS, BS_MONTHS_EN, NP_DAYS };
