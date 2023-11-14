import fetch from "node-fetch";
import EventEmitter from "events";


export default class Tarallo extends EventEmitter {
	constructor(baseUrl, token) {
		super();
		this.baseUrl = baseUrl;
		this.token = token;
		this.available = false;
		this.features = {};
		this.emit("unavailable"); // in the future we should check regularly if tarallo is available and emit events accordingly

		if (this.baseUrl !== undefined && this.token !== undefined) {
			this.get("/v2/session").then(() => {
				this.available = true;
				this.updateFeaturesFile();
				this.emit("available");
				console.log('Tarallo session successfully validated');
			}).catch((e) => {
				console.log('WARNING: Tarallo not succesfully authenticated');
			});
		} else {
			console.log("WARNING: Tarallo not available");
		}
	}

	async get(url) {
		return new Promise((resolve, reject) => {
			fetch(this.baseUrl + url, {headers:{"Authorization":"Token "+this.token}})
				.then(async res => {
					if (res.status - 300 >= 0) {
						reject(await res.json());
					} else {
						resolve(await res.json());
					}
				}).catch(reject);
		});
	}

	async post(url, body) {
		return new Promise((resolve, reject) => {
			fetch(this.baseUrl + url, {headers:{"Authorization":"Token "+this.token, "Content-Type":"application/json"}, body: JSON.stringify(body), method:"post"})
				.then(async res => {
					if (res.status - 300 >= 0) {
						reject(await res.json());
					} else {
						resolve(await res.json());
					}
				}).catch(reject);
		});
	}

	async patch(url, body) {
		return new Promise((resolve, reject) => {
			fetch(this.baseUrl + url, {headers:{"Authorization":"Token "+this.token, "Content-Type":"application/json"}, body: JSON.stringify(body), method:"patch"})
				.then(async res => {
					if (res.status - 300 >= 0) {
						reject(await res.json());
					} else {
						resolve(await res.json());
					}
				}).catch(reject);
		});
	}

	async put(url, body) {
		return new Promise((resolve, reject) => {
			fetch(this.baseUrl + url, {headers:{"Authorization":"Token "+this.token}, body: JSON.stringify(body), method:"put"})
				.then(async res => {
					if (res.status - 300 >= 0) {
						reject(await res.json());
					} else {
						resolve(await res.json());
					}
				}).catch(reject);
		});
	}

	async updateFeaturesFile() {
		this.features = await this.get("/features.json");
	}

	async getCodeFromSerialNumber(serialNumber) {
		if (!this.available) return;
		if (serialNumber.startsWith("WD-")) // this is legacy stuff
			serialNumber = serialNumber.slice(3);
			
		return (await this.get("/v2/features/sn/" + encodeURI(serialNumber)))[0];
	}

	async getInfoFromCode(code) {
		if (!this.available) return;
		return this.get("/v2/items/" + encodeURI(code));
	}

	async getInfoFromSerialNumber(serialNumber) {
		if (!this.available) return;
		let code = this.getCodeFromSerialNumber(serialNumber);
		if (code == null) return;

		return this.getInfoFromCode(code);
	}
	
	async updateFeatures(code, features) {
		if (!this.available) return;
		return this.patch("/v2/items/" + encodeURI(code) + "/features", features);
	}

	async realignItem(code, features) { // will overwrite all features
		if (!this.available) return;
		return this.put("/v2/items/" + encodeURI(code) + "/features", features);
	}

	async createItem(features, location, code) {
		if (!this.available) return;
		if (code === undefined) {
			return this.post("/v2/items", {
				parent: location,
				features,
				contents: []
			});
		}
		return this.put("/v2/items/" + encodeURI(code), {
			parent: location,
			features,
			contents: []
		});
	}

}