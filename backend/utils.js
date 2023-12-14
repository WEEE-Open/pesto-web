

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
		return power_on_time.minutes / 60; // original version: minutes * 60
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

		smart_data[name] = value;

		// Find out if anything is failing (update the value only if not already true)
		failing_now = failing_now ||
			(line.when_failed === "now" && name !== "temperature_celsius");
	}

	return { smart_data, failing_now };
}

/**
 *  Get disk status from smartctl output.
 *  This algorithm has been mined: it's based on a decision tree with "accuracy" criterion since seems to produce
 *  slightly better results than the others. And the tree is somewhat shallow, which makes the algorithm more
 *  human-readable. There's no much theory other than that, so there's no real theory here.
 *  The data is about 200 smartctl outputs for every kind of hard disk, manually labeled with pestello (and mortaio)
 *  according to how I would classify them or how they are acting: if an HDD is making horrible noises and cannot
 *  perform a single read without throwing I/O errors, it's failed, no matter what the smart data says.
 *  Initially I tried to mix SSDs in, but their attributes are way different and they are also way easier to
 *  classify, so this algorithm works on mechanical HDDs only.
 *  This is the raw tree as output by RapidMiner:
 *  Current_Pending_Sector > 0.500
 *  |   Load_Cycle_Count = ?: FAIL {FAIL=9, SUS=0, OK=1, OLD=0}
 *  |   Load_Cycle_Count > 522030: SUS {FAIL=0, SUS=3, OK=0, OLD=0}
 *  |   Load_Cycle_Count ≤ 522030: FAIL {FAIL=24, SUS=0, OK=1, OLD=0}
 *  Current_Pending_Sector ≤ 0.500
 *  |   Reallocated_Sector_Ct = ?: OK {FAIL=1, SUS=0, OK=4, OLD=0}
 *  |   Reallocated_Sector_Ct > 0.500
 *  |   |   Reallocated_Sector_Ct > 3: FAIL {FAIL=8, SUS=1, OK=0, OLD=0}
 *  |   |   Reallocated_Sector_Ct ≤ 3: SUS {FAIL=0, SUS=4, OK=0, OLD=0}
 *  |   Reallocated_Sector_Ct ≤ 0.500
 *  |   |   Power_On_Hours = ?
 *  |   |   |   Run_Out_Cancel = ?: OK {FAIL=0, SUS=1, OK=3, OLD=1}
 *  |   |   |   Run_Out_Cancel > 27: SUS {FAIL=0, SUS=2, OK=0, OLD=0}
 *  |   |   |   Run_Out_Cancel ≤ 27: OK {FAIL=1, SUS=0, OK=6, OLD=1}
 *  |   |   Power_On_Hours > 37177.500
 *  |   |   |   Spin_Up_Time > 1024.500
 *  |   |   |   |   Power_Cycle_Count > 937.500: SUS {FAIL=0, SUS=1, OK=0, OLD=1}
 *  |   |   |   |   Power_Cycle_Count ≤ 937.500: OK {FAIL=0, SUS=0, OK=3, OLD=0}
 *  |   |   |   Spin_Up_Time ≤ 1024.500: OLD {FAIL=0, SUS=0, OK=2, OLD=12}
 *  |   |   Power_On_Hours ≤ 37177.500
 *  |   |   |   Start_Stop_Count = ?: OK {FAIL=0, SUS=0, OK=3, OLD=0}
 *  |   |   |   Start_Stop_Count > 13877: OLD {FAIL=1, SUS=0, OK=0, OLD=2}
 *  |   |   |   Start_Stop_Count ≤ 13877: OK {FAIL=2, SUS=9, OK=89, OLD=4}
 *  but some manual adjustments were made, just to be safe.
 *  Most HDDs are working so the data is somewhat biased, but there are some very obvious red flags like smartctl
 *  reporting failing attributes (except temperature, which doesn't matter and nobody cares) or having both
 *  reallocated AND pending sectors, where nobody would keep using that HDD, no matter what the tree decides.
 *
 * @param {*} smart_data Smartctl data
 * @param {Boolean} failing_now If any attribute is marked as failing
 * @returns {String} HDD status (label)
 */
export function smart_health_status(smart_data, failing_now) {
	if (failing_now)
    return "fail";

	if (Number(smart_data.Current_Pending_Sector) > 0) {
		// This part added manually just to be safe
		if (Number(smart_data.Reallocated_Sector_Ct) > 3)
			return "fail";

		// I wonder if this part is overfitted... who cares, anyway.
		const cycles = smart_data.Load_Cycle_Count;
		if (cycles)
			return Number(cycles) > 522030 ? "sus" : "fail";

		return "fail";
	} else {
		const reallocated = Number(smart_data.Reallocated_Sector_Ct);
		if (reallocated > 0) {
			return reallocated > 3 ? "fail" : "sus";
		} else {
			const hours = smart_data.Power_On_Hours;

			if (hours) {
				// 4.2 years as a server (24/7), 15.2 years in an office pc (8 hours a day, 304 days a year)
				if (Number(hours) > 37177) {
					if (Number(smart_data.Spin_Up_Time) <= 1024)
						return "old";

					/*
					 * Checking this attribute tells us if it's more likely to be a server HDD or an office HDD
					 * The tree says 1 old and 1 sus here, but there's too little data to throw around "sus"
					 * like this... it needs more investigation, though: if the disk is slow at starting up
					 * it may tell something about its components starting to fail.
					 */
					return Number(smart.Power_Cycle_Count) > 937 ? "old" : "ok";
				} else {
					/*
					 * This whole area is not very good, but there are too many "ok" disks and too few not-ok ones
					 * to mine something better
					 */
					return Number(smart_data.Start_Stop_Count) > 13877 ? "old" : "ok";
				}
			} else {
				// This attribute is a good indication that something is suspicious
				return (Number(smart_data.Run_Out_Cancel) > 27) ? "sus" : "ok";
			}
		}
	}
}
