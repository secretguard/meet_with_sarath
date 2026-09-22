// Shared WhatsApp-number country picker — used by /apply/ and the main
// booking page's details step. No network call, no build step: calling
// codes verified against Wikipedia's "List of country calling codes"
// (2026-09-22) for a deliberately non-exhaustive ~120-country list covering
// the realistic audience for this site (South Asia, the Gulf, North
// America/Europe, Southeast/East Asia, Oceania, and Africa/Latin America's
// largest economies). Missing a country just means the visitor picks the
// closest one or types their number with a different prefix — this is a
// convenience default, never something the backend trusts blindly.
//
// PHONE_COUNTRIES: { iso2, name, dial } — dial has no leading '+'.
const PHONE_COUNTRIES = [
  { iso2: 'IN', name: 'India', dial: '91' },
  { iso2: 'US', name: 'United States', dial: '1' },
  { iso2: 'CA', name: 'Canada', dial: '1' },
  { iso2: 'MX', name: 'Mexico', dial: '52' },
  { iso2: 'CR', name: 'Costa Rica', dial: '506' },
  { iso2: 'PA', name: 'Panama', dial: '507' },
  { iso2: 'CU', name: 'Cuba', dial: '53' },
  { iso2: 'DO', name: 'Dominican Republic', dial: '1' },
  { iso2: 'JM', name: 'Jamaica', dial: '1' },
  { iso2: 'TT', name: 'Trinidad and Tobago', dial: '1' },
  { iso2: 'BR', name: 'Brazil', dial: '55' },
  { iso2: 'AR', name: 'Argentina', dial: '54' },
  { iso2: 'CL', name: 'Chile', dial: '56' },
  { iso2: 'CO', name: 'Colombia', dial: '57' },
  { iso2: 'PE', name: 'Peru', dial: '51' },
  { iso2: 'VE', name: 'Venezuela', dial: '58' },
  { iso2: 'EC', name: 'Ecuador', dial: '593' },
  { iso2: 'BO', name: 'Bolivia', dial: '591' },
  { iso2: 'PY', name: 'Paraguay', dial: '595' },
  { iso2: 'UY', name: 'Uruguay', dial: '598' },
  { iso2: 'GB', name: 'United Kingdom', dial: '44' },
  { iso2: 'IE', name: 'Ireland', dial: '353' },
  { iso2: 'FR', name: 'France', dial: '33' },
  { iso2: 'DE', name: 'Germany', dial: '49' },
  { iso2: 'NL', name: 'Netherlands', dial: '31' },
  { iso2: 'BE', name: 'Belgium', dial: '32' },
  { iso2: 'CH', name: 'Switzerland', dial: '41' },
  { iso2: 'AT', name: 'Austria', dial: '43' },
  { iso2: 'ES', name: 'Spain', dial: '34' },
  { iso2: 'PT', name: 'Portugal', dial: '351' },
  { iso2: 'IT', name: 'Italy', dial: '39' },
  { iso2: 'SE', name: 'Sweden', dial: '46' },
  { iso2: 'NO', name: 'Norway', dial: '47' },
  { iso2: 'DK', name: 'Denmark', dial: '45' },
  { iso2: 'FI', name: 'Finland', dial: '358' },
  { iso2: 'PL', name: 'Poland', dial: '48' },
  { iso2: 'GR', name: 'Greece', dial: '30' },
  { iso2: 'RU', name: 'Russia', dial: '7' },
  { iso2: 'UA', name: 'Ukraine', dial: '380' },
  { iso2: 'BY', name: 'Belarus', dial: '375' },
  { iso2: 'RO', name: 'Romania', dial: '40' },
  { iso2: 'BG', name: 'Bulgaria', dial: '359' },
  { iso2: 'HU', name: 'Hungary', dial: '36' },
  { iso2: 'CZ', name: 'Czechia', dial: '420' },
  { iso2: 'SK', name: 'Slovakia', dial: '421' },
  { iso2: 'HR', name: 'Croatia', dial: '385' },
  { iso2: 'RS', name: 'Serbia', dial: '381' },
  { iso2: 'SI', name: 'Slovenia', dial: '386' },
  { iso2: 'BA', name: 'Bosnia and Herzegovina', dial: '387' },
  { iso2: 'MK', name: 'North Macedonia', dial: '389' },
  { iso2: 'AL', name: 'Albania', dial: '355' },
  { iso2: 'MD', name: 'Moldova', dial: '373' },
  { iso2: 'CY', name: 'Cyprus', dial: '357' },
  { iso2: 'IS', name: 'Iceland', dial: '354' },
  { iso2: 'LU', name: 'Luxembourg', dial: '352' },
  { iso2: 'MT', name: 'Malta', dial: '356' },
  { iso2: 'EE', name: 'Estonia', dial: '372' },
  { iso2: 'LV', name: 'Latvia', dial: '371' },
  { iso2: 'LT', name: 'Lithuania', dial: '370' },
  { iso2: 'TR', name: 'Turkey', dial: '90' },
  { iso2: 'AE', name: 'United Arab Emirates', dial: '971' },
  { iso2: 'SA', name: 'Saudi Arabia', dial: '966' },
  { iso2: 'QA', name: 'Qatar', dial: '974' },
  { iso2: 'KW', name: 'Kuwait', dial: '965' },
  { iso2: 'BH', name: 'Bahrain', dial: '973' },
  { iso2: 'OM', name: 'Oman', dial: '968' },
  { iso2: 'IL', name: 'Israel', dial: '972' },
  { iso2: 'JO', name: 'Jordan', dial: '962' },
  { iso2: 'LB', name: 'Lebanon', dial: '961' },
  { iso2: 'IQ', name: 'Iraq', dial: '964' },
  { iso2: 'IR', name: 'Iran', dial: '98' },
  { iso2: 'SY', name: 'Syria', dial: '963' },
  { iso2: 'YE', name: 'Yemen', dial: '967' },
  { iso2: 'PK', name: 'Pakistan', dial: '92' },
  { iso2: 'BD', name: 'Bangladesh', dial: '880' },
  { iso2: 'LK', name: 'Sri Lanka', dial: '94' },
  { iso2: 'NP', name: 'Nepal', dial: '977' },
  { iso2: 'BT', name: 'Bhutan', dial: '975' },
  { iso2: 'MV', name: 'Maldives', dial: '960' },
  { iso2: 'AF', name: 'Afghanistan', dial: '93' },
  { iso2: 'SG', name: 'Singapore', dial: '65' },
  { iso2: 'MY', name: 'Malaysia', dial: '60' },
  { iso2: 'ID', name: 'Indonesia', dial: '62' },
  { iso2: 'PH', name: 'Philippines', dial: '63' },
  { iso2: 'TH', name: 'Thailand', dial: '66' },
  { iso2: 'VN', name: 'Vietnam', dial: '84' },
  { iso2: 'MM', name: 'Myanmar', dial: '95' },
  { iso2: 'KH', name: 'Cambodia', dial: '855' },
  { iso2: 'LA', name: 'Laos', dial: '856' },
  { iso2: 'CN', name: 'China', dial: '86' },
  { iso2: 'JP', name: 'Japan', dial: '81' },
  { iso2: 'KR', name: 'South Korea', dial: '82' },
  { iso2: 'HK', name: 'Hong Kong', dial: '852' },
  { iso2: 'TW', name: 'Taiwan', dial: '886' },
  { iso2: 'MN', name: 'Mongolia', dial: '976' },
  { iso2: 'KZ', name: 'Kazakhstan', dial: '7' },
  { iso2: 'UZ', name: 'Uzbekistan', dial: '998' },
  { iso2: 'GE', name: 'Georgia', dial: '995' },
  { iso2: 'AM', name: 'Armenia', dial: '374' },
  { iso2: 'AZ', name: 'Azerbaijan', dial: '994' },
  { iso2: 'AU', name: 'Australia', dial: '61' },
  { iso2: 'NZ', name: 'New Zealand', dial: '64' },
  { iso2: 'FJ', name: 'Fiji', dial: '679' },
  { iso2: 'PG', name: 'Papua New Guinea', dial: '675' },
  { iso2: 'ZA', name: 'South Africa', dial: '27' },
  { iso2: 'NG', name: 'Nigeria', dial: '234' },
  { iso2: 'KE', name: 'Kenya', dial: '254' },
  { iso2: 'EG', name: 'Egypt', dial: '20' },
  { iso2: 'MA', name: 'Morocco', dial: '212' },
  { iso2: 'GH', name: 'Ghana', dial: '233' },
  { iso2: 'LY', name: 'Libya', dial: '218' },
  { iso2: 'TN', name: 'Tunisia', dial: '216' },
  { iso2: 'DZ', name: 'Algeria', dial: '213' },
  { iso2: 'SD', name: 'Sudan', dial: '249' },
  { iso2: 'ET', name: 'Ethiopia', dial: '251' },
  { iso2: 'TZ', name: 'Tanzania', dial: '255' },
  { iso2: 'UG', name: 'Uganda', dial: '256' },
  { iso2: 'ZM', name: 'Zambia', dial: '260' },
  { iso2: 'ZW', name: 'Zimbabwe', dial: '263' },
  { iso2: 'BW', name: 'Botswana', dial: '267' },
  { iso2: 'NA', name: 'Namibia', dial: '264' },
  { iso2: 'MZ', name: 'Mozambique', dial: '258' },
  { iso2: 'RW', name: 'Rwanda', dial: '250' },
  { iso2: 'SN', name: 'Senegal', dial: '221' },
  { iso2: 'CI', name: "Cote d'Ivoire", dial: '225' },
  { iso2: 'CM', name: 'Cameroon', dial: '237' },
  { iso2: 'AO', name: 'Angola', dial: '244' },
  { iso2: 'CD', name: 'DR Congo', dial: '243' }
];

// A best-effort default only — always overridable by the visitor. Not
// exhaustive; falls back to India (this business's primary market) when
// neither signal resolves to a country in PHONE_COUNTRIES.
const PHONE_TZ_COUNTRY = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Anchorage': 'US', 'America/Phoenix': 'US', 'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/St_Johns': 'CA',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE',
  'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH', 'Asia/Muscat': 'OM',
  'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Darwin': 'AU', 'Australia/Hobart': 'AU',
  'Pacific/Auckland': 'NZ',
  'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Colombo': 'LK', 'Asia/Kathmandu': 'NP',
  'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Amsterdam': 'NL', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE', 'Europe/Moscow': 'RU',
  'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE', 'Africa/Cairo': 'EG',
  'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW',
  'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX'
};

// Same 8–15-digit check as the backend's looksLikePhoneNumber() — loose on
// purpose (no country-specific format check beyond digit count). Shared by
// /apply/ and the booking page so both validate a combined "+<dial>
// <digits>" value the same way.
function looksLikePhoneNumber(v) {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

// Regional-indicator flag emoji from an ISO 3166-1 alpha-2 code — no image
// assets needed.
function phoneFlagEmoji(iso2) {
  return String.fromCodePoint(...String(iso2).toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
}

// Priority: IANA timezone → the browser's own language region tag → India.
// Timezone goes first deliberately: it tracks the device's actual clock
// setting, which almost always matches where the visitor really is. The
// language tag is a weaker signal in practice — most browsers report a
// generic "en-US" unless the visitor has gone out of their way to change
// OS/browser regional settings, so an Indian visitor on an out-of-the-box
// "en-US" browser was previously (and wrongly) defaulted to the US.
function guessDefaultCountryIso2() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (PHONE_TZ_COUNTRY[tz]) return PHONE_TZ_COUNTRY[tz];
  } catch (e) {}
  try {
    const langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const m = /-([A-Za-z]{2})$/.exec(l || '');
      if (m) {
        const code = m[1].toUpperCase();
        if (PHONE_COUNTRIES.some(c => c.iso2 === code)) return code;
      }
    }
  } catch (e) {}
  return 'IN';
}

// Renders the <option>s into a <select> — India pinned first (this
// business's primary market), then the rest alphabetically — and selects
// the guessed default.
function initPhonePicker(selectEl) {
  const india = PHONE_COUNTRIES.find(c => c.iso2 === 'IN');
  const rest = PHONE_COUNTRIES.filter(c => c.iso2 !== 'IN').sort((a, b) => a.name.localeCompare(b.name));
  const ordered = [india, ...rest];
  selectEl.innerHTML = ordered.map(c => `<option value="${c.iso2}" data-dial="${c.dial}">${phoneFlagEmoji(c.iso2)} +${c.dial} — ${c.name}</option>`).join('');
  selectEl.value = guessDefaultCountryIso2();
}

// Combines the picker + digits input into the one string the backend
// expects ("+91 9876543210"), or '' if the digits field is empty. A leading
// 0 is dropped — that's a domestic trunk-dialling habit (UK "07911...",
// France "0…", India landlines, etc.), never part of the actual subscriber
// number, and left in it would silently produce a dead wa.me link.
function combinedPhoneValue(selectEl, digitsEl) {
  const opt = selectEl.selectedOptions[0];
  const dial = opt ? opt.dataset.dial : '';
  const digits = String(digitsEl.value || '').replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `+${dial} ${digits}` : '';
}

// Splits a previously-stored combined value ("+91 9876543210") back into
// the picker + digits input, for prefilling a returning applicant. Falls
// back to putting the whole thing in the digits field if no known dial
// code prefixes it.
function splitPhoneValue(selectEl, digitsEl, stored) {
  const digits = String(stored || '').replace(/\D/g, '');
  if (!digits) return;
  const byDialDesc = PHONE_COUNTRIES.slice().sort((a, b) => b.dial.length - a.dial.length);
  const match = byDialDesc.find(c => digits.startsWith(c.dial));
  if (match) {
    selectEl.value = match.iso2;
    digitsEl.value = digits.slice(match.dial.length);
  } else {
    digitsEl.value = digits;
  }
}
