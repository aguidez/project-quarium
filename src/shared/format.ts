/**
 * Number formatting shared by the UI and the server's messages. Money goes up to MAX_MONEY (1e300): Luau's tostring
 * switches to exponents from 1e15 ("1e+15") and drops digits from 1e14, so whole numbers are printed with "%.0f"
 * below FULL_DIGITS_LIMIT, the big ones are shortened with the incremental-game units (K, M, B, T, Qa… Vg = 1e63),
 * and past the last unit written in scientific notation ("1.23e66").
 */

/** Short units, smallest first: SUFFIXES[i] is 1e(3 x (i + 1)). */
const SUFFIXES: readonly string[] = [
	"K",
	"M",
	"B",
	"T",
	"Qa",
	"Qi",
	"Sx",
	"Sp",
	"Oc",
	"No",
	"Dc",
	"Ud",
	"Dd",
	"Td",
	"Qad",
	"Qid",
	"Sxd",
	"Spd",
	"Ocd",
	"Nod",
	"Vg",
];
/** K only from 10,000 (2,500 reads better than 2.5K). */
const SHORT_FROM = 1e4;
/** formatNumber writes every digit below this, then shortens (1,234,567,890 but 1.23T). */
const FULL_DIGITS_LIMIT = 1e12;
/** The biggest finite double: an infinity (never in a save, MAX_MONEY) is written as it. */
const MAX_FINITE = 1.7976931348623157e308;

/** `value` with at most `decimals` decimals, trailing zeros dropped: 2.50 -> "2.5", 3.00 -> "3". */
function trim(value: number, decimals: number): string {
	const [text] = string.format(`%.${decimals}f`, value).gsub("%.?0+$", "");
	return text;
}

/** `value` rounded to `decimals` decimals, as a number (to catch 999.96 rounding up to 1000). */
function rounded(value: number, decimals: number): number {
	return tonumber(string.format(`%.${decimals}f`, value)) ?? 0;
}

/** "1.23e66": past the last unit. */
function scientific(value: number, decimals: number): string {
	let exponent = math.floor(math.log10(value));
	let mantissa = value / 10 ** exponent;
	// log10 can land a hair off an exact power (9.99… or 10.0…): bring the mantissa back into [1, 10)
	if (rounded(mantissa, decimals) >= 10) {
		exponent += 1;
		mantissa = value / 10 ** exponent;
	} else if (mantissa < 1) {
		exponent -= 1;
		mantissa = value / 10 ** exponent;
	}
	return `${trim(mantissa, decimals)}e${exponent}`;
}

function shorten(value: number, decimals: number): string {
	if (value !== value) return "0"; // NaN
	if (value < 0) return `-${shorten(-value, decimals)}`;
	if (value < SHORT_FROM) return formatNumber(value);
	value = math.min(value, MAX_FINITE);
	// The biggest unit not above the value (compared to exact powers, not log10, which is a hair off at 1e15)
	let index = 0;
	while (index + 1 < SUFFIXES.size() && value >= 10 ** (3 * (index + 2))) index++;
	let scaled = value / 10 ** (3 * (index + 1));
	// 999,960 would round to "1000K": that is "1M"
	if (rounded(scaled, decimals) >= 1000) {
		index++;
		scaled = value / 10 ** (3 * (index + 1));
	}
	if (index >= SUFFIXES.size()) return scientific(value, decimals);
	return `${trim(scaled, decimals)}${SUFFIXES[index]}`;
}

/** "1234567" -> "1,234,567"; from a trillion on, shortened with 2 decimals ("1.23T", "4.5Qa", "7.1Vg", "1.23e66"). */
export function formatNumber(value: number): string {
	if (value !== value) return "0"; // NaN
	if (math.abs(value) >= FULL_DIGITS_LIMIT) return shorten(value, 2);
	const [digits] = string.format("%.0f", math.floor(math.abs(value))).reverse().gsub("(%d%d%d)", "%1,");
	const [result] = digits.reverse().gsub("^,", "");
	return value < 0 ? `-${result}` : result;
}

/** Short amount for small tags: "2,500", "25K", "150K", "1.5M", "6.1B", "1.8T", "1Qa", "3.2Sx", "1.2e70". */
export function formatShort(value: number): string {
	return shorten(value, 1);
}
