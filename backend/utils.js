

export function prettyPrintBytes(bytes) {
	const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	const base = 1024;
	const threshold = 0.9; // Adjust this threshold as needed

	if (bytes < base) {
	  return bytes + ' ' + units[0];
	}

	let exponent = Math.floor(Math.log(bytes) / Math.log(base));
	let value = bytes / Math.pow(base, exponent);

	if (value > threshold) {
	  value = value.toFixed(1);
	  exponent++;
	} else {
	  value = Math.round(value);
	}

	return value + ' ' + units[exponent];
}


export function splitBrandAndOther(line) {
	let lowered = line.toLowerCase();

	let possibilities = [
		"WDC ",
		"Western Digital",
		"Seagate",
		"Maxtor",
		"Hitachi",
		"Toshiba",
		"Samsung",
		"Fujitsu",
		"Apple",
		"Crucial/Micron",
		"Crucial",
		"LiteOn",
		"Kingston",
		"Adata",
		"Quantum",
	];

	let brand = null;
	let other = line;
	for (let i = 0; i < possibilities.length; i++) {
		let possible = possibilities[i];
		if (lowered.startsWith(possible.toLowerCase())) {
			brand = possible.trim();
			other = line.slice(possible.length).trimStart("_").trim();
			break;
		}
	}

	return [brand, other];
}

/**
 * Normalize power on time to hours
 * (see https://github.com/mirror/smartmontools/blob/44cdd4ce63ca4e07db87ec062a159181be967a72/ataprint.cpp#L1140-L1168)
 */
function normalize_power_on_time(power_on_time) {
	if (power_on_time?.hours)
		return power_on_time.hours;
	if (power_on_time?.minutes)
		return power_on_time.minutes / 60;
	return undefined;
}

/**
 * Extract SMART attributes and raw values from smartctl -ja output.
 * Also returns failing_now value to indicate if any attributes (except temperature)
 * is failing now.
 * @param {*} features
 */
export function extract_smart_data(features) {
	let failing_now = false;
	const smart_data = {};

	const ata_smart_attr_table = features?.ata_smart_attributes?.table;

	if (!ata_smart_attr_table)
		return { smart_data, failing_now }

	for (const line of ata_smart_attr_table) {
		let name = line.name.toLowerCase();
		let value = line.raw.value;

		if (name === "unknown_attribute") {
			name += `_${line.id}`; // "unknown_attribute_8" for example
		} else if (line.id === 9 && name.startsWith("power_on_")) {
			// if there is the hours/minutes of power on then update the value
			value = normalize_power_on_time(features.power_on_time) || value;
		}

		smart_data.name = value;

		// Find out if anything is failing (update the value only if not already true)
		failing_now = failing_now ||
			(line.when_failed === "now" && name !== "temperature_celsius");
	}

	return { smart_data, failing_now };
}
