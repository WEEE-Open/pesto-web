

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