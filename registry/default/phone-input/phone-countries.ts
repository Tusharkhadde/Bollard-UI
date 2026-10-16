/**
 * Built-in phone numbering data for 245 countries and territories, derived from Google's
 * libphonenumber metadata (mobile and fixed-line lengths only, so a toll-free length can't make a
 * short mobile number look complete). About 3.5 kB gzipped. Pass your own list to `PhoneInput`
 * through `countries` to trim or extend it.
 */

export interface PhoneCountry {
  /** English name, shown unless the field gets a `locale`. */
  name: string
  /** Country calling code without the +. */
  dial: string
  /** Allowed national significant number lengths, [min, max]. */
  lengths: [number, number]
  /** Domestic trunk prefix that is dropped when dialling internationally. */
  trunk?: string
  /** Digit groups used to display the national number. */
  groups: number[]
  /**
   * For a dial code shared by several countries (+1, +7, +44…): a regex the national number starts
   * with, e.g. "876|658" for Jamaica. Countries without one are the fallback; the first listed wins.
   */
  leading?: string
}

export type PhoneCountryCode =
  | "AC" | "AD" | "AE" | "AF" | "AG" | "AI" | "AL" | "AM" | "AO" | "AR" | "AS" | "AT" | "AU" | "AW"
  | "AX" | "AZ" | "BA" | "BB" | "BD" | "BE" | "BF" | "BG" | "BH" | "BI" | "BJ" | "BL" | "BM" | "BN"
  | "BO" | "BQ" | "BR" | "BS" | "BT" | "BW" | "BY" | "BZ" | "CA" | "CC" | "CD" | "CF" | "CG" | "CH"
  | "CI" | "CK" | "CL" | "CM" | "CN" | "CO" | "CR" | "CU" | "CV" | "CW" | "CX" | "CY" | "CZ" | "DE"
  | "DJ" | "DK" | "DM" | "DO" | "DZ" | "EC" | "EE" | "EG" | "EH" | "ER" | "ES" | "ET" | "FI" | "FJ"
  | "FK" | "FM" | "FO" | "FR" | "GA" | "GB" | "GD" | "GE" | "GF" | "GG" | "GH" | "GI" | "GL" | "GM"
  | "GN" | "GP" | "GQ" | "GR" | "GT" | "GU" | "GW" | "GY" | "HK" | "HN" | "HR" | "HT" | "HU" | "ID"
  | "IE" | "IL" | "IM" | "IN" | "IO" | "IQ" | "IR" | "IS" | "IT" | "JE" | "JM" | "JO" | "JP" | "KE"
  | "KG" | "KH" | "KI" | "KM" | "KN" | "KP" | "KR" | "KW" | "KY" | "KZ" | "LA" | "LB" | "LC" | "LI"
  | "LK" | "LR" | "LS" | "LT" | "LU" | "LV" | "LY" | "MA" | "MC" | "MD" | "ME" | "MF" | "MG" | "MH"
  | "MK" | "ML" | "MM" | "MN" | "MO" | "MP" | "MQ" | "MR" | "MS" | "MT" | "MU" | "MV" | "MW" | "MX"
  | "MY" | "MZ" | "NA" | "NC" | "NE" | "NF" | "NG" | "NI" | "NL" | "NO" | "NP" | "NR" | "NU" | "NZ"
  | "OM" | "PA" | "PE" | "PF" | "PG" | "PH" | "PK" | "PL" | "PM" | "PR" | "PS" | "PT" | "PW" | "PY"
  | "QA" | "RE" | "RO" | "RS" | "RU" | "RW" | "SA" | "SB" | "SC" | "SD" | "SE" | "SG" | "SH" | "SI"
  | "SJ" | "SK" | "SL" | "SM" | "SN" | "SO" | "SR" | "SS" | "ST" | "SV" | "SX" | "SY" | "SZ" | "TA"
  | "TC" | "TD" | "TG" | "TH" | "TJ" | "TK" | "TL" | "TM" | "TN" | "TO" | "TR" | "TT" | "TV" | "TW"
  | "TZ" | "UA" | "UG" | "US" | "UY" | "UZ" | "VA" | "VC" | "VE" | "VG" | "VI" | "VN" | "VU" | "WF"
  | "WS" | "XK" | "YE" | "YT" | "ZA" | "ZM" | "ZW"

// code|name|dial|min-max|trunk|groups|leading (the leading regex may itself contain |). The main country of each shared dial code comes first.
const DATA =
  "AC|Ascension Island|247|5||5;AD|Andorra|376|6-9||3,3;AE|United Arab Emirates|971|8-9|0|2,3,4;" +
  "AF|Afghanistan|93|9|0|2,3,4;AL|Albania|355|8-9|0|2,3,4;AM|Armenia|374|8|0|2,6;AO|Angola|244|9||3,3,3;" +
  "AR|Argentina|54|10-11|0|1,2,4,4;AT|Austria|43|4-13|0|3,6;AU|Australia|61|9|0|3,3,3;AW|Aruba|297|7||3,4;" +
  "AZ|Azerbaijan|994|9|0|2,3,2,2;BA|Bosnia & Herzegovina|387|8-9|0|2,3,3;BD|Bangladesh|880|6-10|0|4,6;" +
  "BE|Belgium|32|8-9|0|3,2,2,2;BF|Burkina Faso|226|8||2,2,2,2;BG|Bulgaria|359|6-9|0|2,3,3;BH|Bahrain|973|8||4,4;" +
  "BI|Burundi|257|8||2,2,2,2;BJ|Benin|229|10||2,2,2,2,2;BN|Brunei|673|7||3,4;BO|Bolivia|591|8|0|8;" +
  "BR|Brazil|55|10-11|0|2,5,4;BT|Bhutan|975|7-8||2,2,2,2;BW|Botswana|267|7-8||2,3,3;BY|Belarus|375|9|8|2,3,2,2;" +
  "BZ|Belize|501|7||3,4;CD|Congo - Kinshasa|243|7-10|0|3,3,3;CF|Central African Republic|236|8||2,2,2,2;" +
  "CG|Congo - Brazzaville|242|9||2,3,4;CH|Switzerland|41|9|0|2,3,2,2;CI|Côte d’Ivoire|225|10||2,2,2,4;" +
  "CK|Cook Islands|682|5||2,3;CL|Chile|56|9||1,4,4;CM|Cameroon|237|9||1,2,2,2,2;CN|China|86|7-11|0|3,4,4;" +
  "CO|Colombia|57|8-10|0|3,7;CR|Costa Rica|506|8||4,4;CU|Cuba|53|6-10|0|1,7;CV|Cape Verde|238|7||3,2,2;" +
  "CW|Curaçao|599|7-8||1,3,4;CY|Cyprus|357|8||2,6;CZ|Czechia|420|9||3,3,3;DE|Germany|49|5-15|0|4,7;" +
  "DJ|Djibouti|253|8||2,2,2,2;DK|Denmark|45|8||2,2,2,2;DZ|Algeria|213|8-9|0|3,2,2,2;EC|Ecuador|593|8-9|0|2,3,4;" +
  "EE|Estonia|372|7-8||4,4;EG|Egypt|20|8-10|0|2,8;ER|Eritrea|291|7|0|1,3,3;ES|Spain|34|9||3,2,2,2;" +
  "ET|Ethiopia|251|9|0|2,3,4;FI|Finland|358|5-10|0|2,7;FJ|Fiji|679|7||3,4;FK|Falkland Islands|500|5||5;" +
  "FM|Micronesia|691|7||3,4;FO|Faroe Islands|298|6||2,2,2;FR|France|33|9|0|1,2,2,2,2;GA|Gabon|241|7-8||2,2,2,2;" +
  "GB|United Kingdom|44|9-10|0|4,6;GE|Georgia|995|9|0|3,2,2,2;GF|French Guiana|594|9|0|3,2,2,2;" +
  "GH|Ghana|233|9|0|2,3,4;GI|Gibraltar|350|8||8;GL|Greenland|299|6||2,2,2;GM|Gambia|220|7-9||3,4;" +
  "GN|Guinea|224|8-9||3,2,2,2;GP|Guadeloupe|590|9|0|3,2,2,2;GQ|Equatorial Guinea|240|9||3,3,3;" +
  "GR|Greece|30|10||3,3,4;GT|Guatemala|502|8||4,4;GW|Guinea-Bissau|245|9||3,3,3;GY|Guyana|592|7||3,4;" +
  "HK|Hong Kong SAR China|852|8||4,4;HN|Honduras|504|8||4,4;HR|Croatia|385|8-9|0|2,3,4;HT|Haiti|509|8||2,2,4;" +
  "HU|Hungary|36|8-9|06|2,3,4;ID|Indonesia|62|7-12|0|3,3,3;IE|Ireland|353|7-10|0|2,3,4;" +
  "IL|Israel|972|8-12|0|2,3,4;IN|India|91|10|0|5,5;IO|British Indian Ocean Territory|246|7||3,4;" +
  "IQ|Iraq|964|8-10|0|3,3,4;IR|Iran|98|6-10|0|3,3,4;IS|Iceland|354|7-9||3,4;IT|Italy|39|6-12||3,3,4;" +
  "JO|Jordan|962|8-9|0|1,4,4;JP|Japan|81|9-10|0|2,4,4;KE|Kenya|254|7-9|0|3,6;KG|Kyrgyzstan|996|9|0|3,3,3;" +
  "KH|Cambodia|855|8-9|0|2,3,3;KI|Kiribati|686|5-8|0|8;KM|Comoros|269|7||3,2,2;KP|North Korea|850|8-10|0|3,3,4;" +
  "KR|South Korea|82|5-10|0|2,4,4;KW|Kuwait|965|8||3,5;LA|Laos|856|8-10|0|2,2,3,3;LB|Lebanon|961|7-8|0|2,3,3;" +
  "LI|Liechtenstein|423|7-9|0|3,3,3;LK|Sri Lanka|94|9|0|2,3,4;LR|Liberia|231|7-9|0|2,3,4;LS|Lesotho|266|8||4,4;" +
  "LT|Lithuania|370|8|0|3,5;LU|Luxembourg|352|4-11||3,3,3;LV|Latvia|371|8||2,3,3;LY|Libya|218|9|0|2,7;" +
  "MA|Morocco|212|9|0|1,2,2,2,2;MC|Monaco|377|8-9|0|1,2,2,2,2;MD|Moldova|373|8|0|3,2,3;" +
  "ME|Montenegro|382|8|0|2,3,3;MG|Madagascar|261|9|0|2,2,3,2;MH|Marshall Islands|692|7|1|3,4;" +
  "MK|North Macedonia|389|8|0|2,3,3;ML|Mali|223|8||2,2,2,2;MM|Myanmar (Burma)|95|6-10|0|1,3,4;" +
  "MN|Mongolia|976|8-10|0|4,4;MO|Macao SAR China|853|8||4,4;MQ|Martinique|596|9|0|3,2,2,2;" +
  "MR|Mauritania|222|8||2,2,2,2;MT|Malta|356|8||4,4;MU|Mauritius|230|7-8||4,4;MV|Maldives|960|7||3,4;" +
  "MW|Malawi|265|7-9|0|3,2,2,2;MX|Mexico|52|10||3,3,4;MY|Malaysia|60|8-10|0|2,3,4;MZ|Mozambique|258|8-9||2,3,4;" +
  "NA|Namibia|264|8-9|0|2,3,4;NC|New Caledonia|687|6||2,2,2;NE|Niger|227|8||2,2,2,2;NF|Norfolk Island|672|6||1,5;" +
  "NG|Nigeria|234|10|0|3,3,4;NI|Nicaragua|505|8||4,4;NL|Netherlands|31|9-11|0|1,8;NO|Norway|47|8||2,2,2,2;" +
  "NP|Nepal|977|8-10|0|3,7;NR|Nauru|674|7||3,4;NU|Niue|683|4-7||3,4;NZ|New Zealand|64|8-10|0|2,3,4;" +
  "OM|Oman|968|8||4,4;PA|Panama|507|7-8||4,4;PE|Peru|51|8-9|0|3,3,3;PF|French Polynesia|689|8||2,2,2,2;" +
  "PG|Papua New Guinea|675|7-8||4,4;PH|Philippines|63|6-10|0|3,3,4;PK|Pakistan|92|9-10|0|3,7;" +
  "PL|Poland|48|7-9||3,3,3;PM|St. Pierre & Miquelon|508|6-9|0|2,2,2;PS|Palestinian Territories|970|8-9|0|3,3,3;" +
  "PT|Portugal|351|9||3,3,3;PW|Palau|680|7||3,4;PY|Paraguay|595|7-9|0|3,6;QA|Qatar|974|8||4,4;" +
  "RE|Réunion|262|9|0|3,2,2,2;RO|Romania|40|6-9|0|3,3,3;RS|Serbia|381|7-12|0|2,7;RU|Russia|7|10|8|3,3,2,2;" +
  "RW|Rwanda|250|8-9|0|3,3,3;SA|Saudi Arabia|966|9|0|2,3,4;SB|Solomon Islands|677|5-7||2,5;" +
  "SC|Seychelles|248|7||1,3,3;SD|Sudan|249|9|0|2,3,4;SE|Sweden|46|7-9|0|2,3,2,2;SG|Singapore|65|8||4,4;" +
  "SH|St. Helena|290|4-5||5;SI|Slovenia|386|8|0|2,3,3;SK|Slovakia|421|6-9|0|3,3,3;SL|Sierra Leone|232|8|0|2,6;" +
  "SM|San Marino|378|8-10||2,2,2,2;SN|Senegal|221|9||2,3,2,2;SO|Somalia|252|6-9|0|1,7;SR|Suriname|597|6-7||3,4;" +
  "SS|South Sudan|211|9|0|3,3,3;ST|São Tomé & Príncipe|239|7||3,4;SV|El Salvador|503|8||4,4;" +
  "SY|Syria|963|8-9|0|3,3,3;SZ|Eswatini|268|8||4,4;TD|Chad|235|8||2,2,2,2;TG|Togo|228|8||2,2,2,2;" +
  "TH|Thailand|66|8-9|0|2,3,4;TJ|Tajikistan|992|9||2,3,4;TK|Tokelau|690|4-7||4;TL|Timor-Leste|670|7-8||4,4;" +
  "TM|Turkmenistan|993|8|8|2,6;TN|Tunisia|216|8||2,3,3;TO|Tonga|676|5-7||3,4;TR|Türkiye|90|10|0|3,3,2,2;" +
  "TV|Tuvalu|688|5-7||2,4;TW|Taiwan|886|8-9|0|3,3,3;TZ|Tanzania|255|9|0|3,3,3;UA|Ukraine|380|9|0|2,3,4;" +
  "UG|Uganda|256|9|0|3,6;US|United States|1|10|1|3,3,4;UY|Uruguay|598|8|0|2,3,3;UZ|Uzbekistan|998|9||2,3,2,2;" +
  "VE|Venezuela|58|10|0|3,7;VN|Vietnam|84|9-10|0|3,3,3;VU|Vanuatu|678|5-7||3,4;WF|Wallis & Futuna|681|6||2,2,2;" +
  "WS|Samoa|685|5-10||2,5;XK|Kosovo|383|8-12|0|2,3,3;YE|Yemen|967|7-9|0|3,3,3;ZA|South Africa|27|5-9|0|2,3,4;" +
  "ZM|Zambia|260|9|0|2,7;ZW|Zimbabwe|263|7-9|0|2,3,4;AG|Antigua & Barbuda|1|10|1|3,3,4|268;" +
  "AI|Anguilla|1|10|1|3,3,4|264;AS|American Samoa|1|10|1|3,3,4|684;AX|Åland Islands|358|6-10|0|2,7|18;" +
  "BB|Barbados|1|10|1|3,3,4|246;" +
  "BL|St. Barthélemy|590|9|0|3,2,2,2|(?:59(?:0(?:2[7-9]|3[3-7]|5[12]|87)|87\\d)|80[6-9]\\d\\d);" +
  "BM|Bermuda|1|10|1|3,3,4|441;BQ|Caribbean Netherlands|599|7||3,4|[347];BS|Bahamas|1|10|1|3,3,4|242;" +
  "CA|Canada|1|10|1|3,3,4|204|226|236|249|250|257|263|273|289|306|343|354|365|367|368|382|403|416|418|428|431|437|438|450|468|474|506|514|519|548|579|581|584|587|600|604|613|622|633|639|647|672|683|705|709|742|753|778|780|782|807|819|825|867|873|879|902|905|942;" +
  "CC|Cocos (Keeling) Islands|61|9|0|3,3,3|8(?:51(?:0(?:02|31|60|89)|1(?:18|76)|223)|91(?:0(?:1[0-2]|29)|1(?:[28]2|50|79)|2(?:10|64)|3(?:[06]8|22)|4[29]8|62|70[23]|959));" +
  "CX|Christmas Island|61|9|0|3,3,3|8(?:51(?:0(?:01|30|59|88)|1(?:17|46|75)|2(?:22|35))|91(?:00[6-9]|1(?:[28]1|49|78)|2(?:09|63)|3(?:12|26|75)|4(?:56|97)|64|7(?:0[01]|1[0-2])|958));" +
  "DM|Dominica|1|10|1|3,3,4|767;DO|Dominican Republic|1|10|1|3,3,4|809|829|849;" +
  "EH|Western Sahara|212|9|0|1,2,2,2,2|528[89];GD|Grenada|1|10|1|3,3,4|473;" +
  "GG|Guernsey|44|10|0|4,6|1481|7781|7839|7911[17];GU|Guam|1|10|1|3,3,4|671;" +
  "IM|Isle of Man|44|10|0|4,6|74576|(?:16|7[56])24;JE|Jersey|44|10|0|4,6|1534|7509|7829|7937|7700[378]|7797;" +
  "JM|Jamaica|1|10|1|3,3,4|658|876;KN|St. Kitts & Nevis|1|10|1|3,3,4|869;KY|Cayman Islands|1|10|1|3,3,4|345;" +
  "KZ|Kazakhstan|7|10|8|3,3,4|7;LC|St. Lucia|1|10|1|3,3,4|758;" +
  "MF|St. Martin|590|9|0|3,2,2,2|(?:59(?:0(?:0[079]|[14]3|[27][79]|3[03-7]|5[0-268]|87)|87\\d)|80[6-9]\\d\\d);" +
  "MP|Northern Mariana Islands|1|10|1|3,3,4|670;MS|Montserrat|1|10|1|3,3,4|664;" +
  "PR|Puerto Rico|1|10|1|3,3,4|787|939;SJ|Svalbard & Jan Mayen|47|8||2,2,2,2|79;SX|Sint Maarten|1|10|1|3,3,4|721;" +
  "TA|Tristan da Cunha|290|4||4|8;TC|Turks & Caicos Islands|1|10|1|3,3,4|649;" +
  "TT|Trinidad & Tobago|1|10|1|3,3,4|868;VA|Vatican City|39|6-11||3,3,4|06698;" +
  "VC|St. Vincent & Grenadines|1|10|1|3,3,4|784;VG|British Virgin Islands|1|10|1|3,3,4|284;" +
  "VI|U.S. Virgin Islands|1|10|1|3,3,4|340;" +
  "YT|Mayotte|262|9|0|3,2,2,2|26(?:89|9(?:0[0-467]|15|5[0-4]|6|[78]0))|639|7093[5-7]"

/** Parses a packed table in the format above, so a trimmed or extended copy can be built the same way. */
export function parsePhoneCountries(packed: string) {
  const out: Record<string, PhoneCountry> = {}
  for (const row of packed.split(";")) {
    const [code, name, dial, len, trunk, groups, ...leads] = row.split("|")
    const leading = leads.join("|")
    const [min, max = min] = len.split("-").map(Number)
    out[code] = { name, dial, lengths: [min, max], groups: groups.split(",").map(Number), ...(trunk && { trunk }), ...(leading && { leading }) }
  }
  return out
}

/** Every built-in country, keyed by ISO 3166 code. */
export const PHONE_COUNTRIES = parsePhoneCountries(DATA) as Record<PhoneCountryCode, PhoneCountry>
