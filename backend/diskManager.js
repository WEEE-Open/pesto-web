import { EventEmitter } from "events";
import { spawn } from 'child_process';
import fs from 'fs/promises';

import { prettyPrintBytes, splitBrandAndOther } from "./utils.js";

import { tarallo, tasksManager } from "./index.js";

export default class DiskManager extends EventEmitter {
	/**
	 * @param {object} opt
	 * @param {number} opt.refreshInterval
	 * @param {array} opt.filter a list of disks to be ignored 
	 */
	constructor(opt) {
		super();
		this.opt = {
			refreshInterval: 10000,
			filter: [],

			...opt
		};
		this.opt.filter = new Set(this.opt.filter);

		this.disks = [];
		this.refreshingList = false;

		if (this.opt.refreshInterval !== 0) {
			setInterval(() => {
				this.refreshDisksList();
			}, this.opt.refreshInterval);
		}
	}

	refreshDisksList() {
		return new Promise(resolve => {
			if (this.refreshingList === true) {
				this.once('disksListUpdateFinish', resolve);
				return;
			}
			this.refreshingList = true;

			const smartctl = spawn("smartctl", [
				'--scan',
				'--json',
			]);

			let buffer = "";

			smartctl.stdout.on('data', (data) => {
				buffer += data;
			});
		
			smartctl.stderr.on('data', (data) => {
				console.error(`smartctl scan error: ${data}`);
			});
		
			smartctl.on('close', (code) => {
				let disksInfo;
				try {
					disksInfo = JSON.parse(buffer);
				} catch (e) {
					console.log(`smartctl scan didn't output valid json: ${buffer} ,code ${code}`);
					return;
				}

				// copy disks into this set
				let existingDisks = new Set(this.disks.map(d => d.name));
				let listUpdated = false;
				
				// for each disk seen by smartctl:
				// if not in the existing disks list, add it to this.disks
				// delete it from existing disks list
				disksInfo.devices?.forEach(disk => {
					if (!existingDisks.has(disk.name) && !this.opt.filter.has(disk.name)) {
						let newDisk = new Disk(disk.name);
						this.disks.push(newDisk);
						newDisk.on('smartData', () => {
							this.emit('smartData', newDisk);
						});
						newDisk.on('taralloCode', () => {
							this.emit('disksListUpdated', this.listDisks());
						});
						this.emit('diskAdded', newDisk);
						listUpdated = true; // something in the list has been updated
					}
					existingDisks.delete(disk.name); // delete the disk scanned by smartctl from existing disks list
				});

				// now existing disks contains only old disks (not seen by smartctl anymore)
				existingDisks.forEach(disk => {
					// find the corresponding index of the disk in the disks list
					let i = this.disks.findIndex(d => d.name === disk);
					// extract the corresponding disk from disks list and remove all listeners from it
					let [old] = this.disks.splice(i, 1);
					old.removeAllListeners();
					this.emit('diskRemoved', old);
					listUpdated = true;
				});
				
				this.refreshingList = false;
				console.log(this.listDisks());
				if (listUpdated) this.emit('disksListUpdated', this.listDisks());
				this.emit('disksListUpdateFinish', this.listDisks());
				resolve(this.listDisks());
			});
		});
	}

	listDisks() {
		return this.disks;
	}

	getDisk(name) {
		return this.disks.find(e => e.name === name);
	}
}

class Disk extends EventEmitter {
	constructor(name) {
		super();
		this.name = name;
		this.nameShort = name.replace("/dev/", "");
		this.busy = false;
		this.size = null; // do not use this in for processes, just use for pretty print, for actual get from smart data
		this.itemCode = null;
		this.taralloProperties = {};
		this.smartData = null;
		this.parsedSmartCtlData = null;
		this.isLoadingSmartData = false;

		this.recoverSmartData().then(() => {
			this.findOnTarallo().catch(console.log);
		}).catch(() => {});
	}

	recoverSmartData() {
		return new Promise((resolve, reject) => {
			if (this.isLoadingSmartData === true) {
				const [succ, fail] = [(data) => {
					resolve(data);
					this.off('smartDataError', fail);
				},(code) => {
					reject(code);
					this.off('smartData', succ);
				}];
				this.once('smartData', succ);
				this.once('smartDataError', fail);
				return;
			}
			this.isLoadingSmartData = true;

			const smartctl = spawn("smartctl", [
				'-iaj',
				this.name
			]);

			let buffer = "";
	
			smartctl.stdout.on('data', (data) => {
				buffer += data;
			});
		
			smartctl.stderr.on('data', (data) => {
				console.error(`smartctl error: ${data}`);
			});
		
			smartctl.on('close', async (code) => {
				try {
					if (/*code !== 0*/ false) { // temporarly disabled because it might give some other code but still be a good result, need to find more info
						console.log(`smartctl was unable to retreive the data of disk ${this.name} and exited with code ${code} and data "${buffer}"`);
						this.smartData = null;
						this.emit('smartDataError', code);
						reject(code);
					} else {
						let newSmartData = JSON.parse(buffer);
						this.smartData = newSmartData;
						this.isLoadingSmartData = false;
						this.size = prettyPrintBytes(this.smartData.user_capacity.bytes/1024);
						this.parsedSmartCtlData = await this.parseSmartCtlData().catch(()=>{});
						this.emit('smartData', this.smartData);
						resolve(this.smartData);
					}
				} catch (e) {
					this.emit('smartDataError', code);
					reject(code);
					console.log(`smartctl didn't output valid json: ${buffer} ,code ${code}, ${e}`);
				}
			});
		});
	}

	async findOnTarallo() {
		if (this.smartData === undefined) return;
		let code = await tarallo.getCodeFromSerialNumber(this.smartData.serial_number);
		this.itemCode = code;
		this.taralloProperties = await tarallo.getInfoFromCode(code);
		this.emit('taralloCode', code);
		return code;
	}

	async parseSmartCtlData() {
		if (this.smartData === null) {
			await this.recoverSmartData();
			if (this.smartData === null)
				throw Error("Disk has no smartData");
		}
		let port = undefined;
		let features = {
			type: "hdd",
		};
		if (this.smartData.vendor !== undefined && this.smartData.product !== undefined) {
			features.brand = this.smartData.vendor;
			features.model = this.smartData.product;
		} else {
			if (this.smartData.model_name !== undefined) {
				let [brand, model] = splitBrandAndOther(this.smartData.model_name);
				features.model = model;
				if (features.brand !== undefined && brand)
					features.brand = brand;
			}

			if (this.smartData.model_family !== undefined) {
				let [brand, family] = splitBrandAndOther(this.smartData.model_family);
				features.family = family;
				if (features.brand !== undefined && brand)
					features.brand = brand;
			}
		}

		if (this.smartData.serial_number !== undefined)
			features.sn = this.smartData.serial_number;
		
		if (this.smartData.brand === "WDC")
			features.brand = "Western Digital";
			if (this.smartData.serial_number !== undefined && this.smartData.serial_number.startsWith("WD-"))
				features.sn = this.smartData.serial_number.slice(3);

		
		if (this.smartData.wwn !== undefined)
			features.wwn = (this.smartData.wwn.naa || "") + (this.smartData.wwn.oui || "") + (this.smartData.wwn.id || "");
		
		switch (this.smartData.form_factor?.name) {
			case '3.5 inches':
				features["hdd-form-factor"] = "3.5";
			break;
			case '2.5 inches':
				features["hdd-form-factor"] = "2.5";
			break;
			case '1.8 inches':
				features["hdd-form-factor"] = "1.8";
			break;
			case 'M.2':
				features["hdd-form-factor"] = "m2";
				port = "m2-ports-n";
			break;
			case 'mSATA':
				features["hdd-form-factor"] = "msata";
				port = "msata-ports-n";
			break;
		}

		if (this.smartData.user_capacity?.bytes !== undefined) {
			const round_digits = Math.floor(Math.log10(Math.abs(parseFloat(this.smartData.user_capacity.bytes)))) - 2;
			features["capacity-decibyte"] = Math.round(parseFloat(this.smartData.user_capacity.bytes) / Math.pow(10, round_digits)) * Math.pow(10, round_digits);
		} 

		if (this.smartData.rotation_rate !== undefined && this.smartData.rotation_rate > 0) {
			features["spin-rate-rpm"] = this.smartData.rotation_rate;
		} else {
			await this.checkIfHDD().then((isHDD) => {
				if (!isHDD) {
					features['type'] = 'ssd';
				}
			}).catch((e) => {console.log(e.toString())});//.catch(() => {});
		}

		if (features.model !== undefined) {
			if (features.model.includes(" SSD") || features.model.includes("SSD ")) {
				features.model = features.model.replace(" SSD", "").replace("SSD ", "").replace("  ", " ").strip();
				if (features.model == "") delete features.model;
				features.type = "ssd";
			} else if (features.model.startsWith("HGST ")) {
				features.model = features.model.slice(5);
				features['brand-manufacturer'] = "HGST";
			}
		}

		if (features.family !== undefined) {
			if (features.family.includes("(SATA)"))
				features.family = features.family.replace("(SATA)", "").strip();
			else if (features.family.includes("(ATA/133 and SATA/150)"))
				features.family = features.family.replace("(ATA/133 and SATA/150)", "").strip();
			else if (features.family.includes("SSD")) {
				features.type = "ssd";
				if (["basedssds", "basedssd"].has(features.family.replace(" ", "").lower()))
					delete features.family;
			} else if (features.family.includes("Serial ATA")) {
				features.family = features.family.replace("Serial ATA", "").strip();
				if (port === undefined)
					port = "sata-ports-n"
			}
		}

		// Unreliable port detection as a fallback
		if (port === undefined) {
			if ((features.family !== undefined && (features.family.includes("SATA") || features.model.includes("SATA"))) || this.smartData.sata_version !== undefined)
				port = "sata-ports-n";
			else if (this.smartData.pata_version !== undefined)
				if (["1.8", "2.5"].includes(features["hdd-form-factor"]))
					port = "mini-ide-ports-n";
				else port = "ide-ports-n";
			else if (this.smartData.nvme_version !== undefined) {
				port = "m2-ports-n";
				features.type = "ssd";
				if (features["hdd-form-factor"] === undefined)
					features["hdd-form-factor"] = "m2";
			} else if (this.smartData.device?.type === "scsi" && this.smartData.device.protocol === "SCSI")
				features.notes = "This is a SCSI disk, however it is not possible to detect the exact connector type. Please set the correct one manually.";
		}

		if (port !== undefined) {
			features[port] = 1;
		}

		return features;
	}

	async uploadOnTarallo(location, code) {
		return tarallo.createItem(this.parsedSmartCtlData || this.parseSmartCtlData(), location, code).then((code) => {
			this.findOnTarallo().catch(() => {});
			return code;
		});
	}

	// https://unix.stackexchange.com/questions/65595/how-to-know-if-a-disk-is-an-ssd-or-an-hdd
	async checkIfHDD() {
		return (await fs.readFile(`/sys/block/${this.nameShort}/queue/rotational`)).toString().trim() == "1";
	}

	format() {
		return tasksManager.startTask("Formatting " + this.name, this, [{program: 'badblocks', options: {}}]);
	}

	toJSON() {
		return {
			name: this.name,
			size: this.size,
			busy: this.busy,
			code: this.itemCode,
			icon: this.parsedSmartCtlData?.type,
			taralloProperties: this.taralloProperties,
			smartData: this.smartData,
			parsedSmartData: this.parsedSmartCtlData,
		}
	}
}