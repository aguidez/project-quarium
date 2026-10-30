/**
 * Number formatting shared by the UI and the server's messages. Money goes up to MAX_MONEY (1e15): Luau's
 * tostring switches to exponents there ("1e+15") and drops digits from 1e14, so integers are printed with
 * "%.0f" and the big ones are shortened.
 */

/** Short units, biggest first: [size, name, used from]; K only from 10,000 (2,500 reads better than 2.5K). */
const UNITS: readonly [number, string, number][] = [
	[1e15, "Qa", 1e15],
	[1e12, "T", 1e12],
	[1e9, "B", 1e9],
	[1e6, "M", 1e6],
	[1e3, "K", 1e4],
];
/** formatNumber writes every digit below this, then shortens (1,234,567,890 but 1.23T). */
const FULL_DIGITS_LIMIT = 1e12;

/** `value` with at most `decimals` decimals, trailing zeros dropped: 2.50 -> "2.5", 3.00 -> "3". */
function trim(value: number, decimals: number): string {
	const [text] = string.format(`%.${decimals}f`, value).gsub("%.?0+$", "");
	return text;
}

function shorten(value: number, decimals: number): string {
	for (let i = 0; i < UNITS.size(); i++) {
		const [size, unit, from] = UNITS[i];
		if (value < from) continue;
		// 999,960 would round to "1000K": that is "1M"
		if ((tonumber(string.format(`%.${decimals}f`, value / size)) ?? 0) >= 1000 && i > 0) {
			const [biggerSize, biggerUnit] = UNITS[i - 1];
			return `${trim(value / biggerSize, decimals)}${biggerUnit}`;
		}
		return `${trim(value / size, decimals)}${unit}`;
	}
	return formatNumber(value);
}

/** "1234567" -> "1,234,567"; from a trillion on, shortened with 2 decimals ("1.23T", "4.5Qa"). */
export function formatNumber(value: number): string {
	if (value >= FULL_DIGITS_LIMIT) return shorten(value, 2);
	const [digits] = string.format("%.0f", math.floor(math.abs(value))).reverse().gsub("(%d%d%d)", "%1,");
	const [result] = digits.reverse().gsub("^,", "");
	return value < 0 ? `-${result}` : result;
}

/** Short amount for small tags: "2,500", "25K", "150K", "1.5M", "6.1B", "1.8T", "1Qa". */
export function formatShort(value: number): string {
	return shorten(value, 1);
}
