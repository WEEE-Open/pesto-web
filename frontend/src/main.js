import { createApp, ref } from 'vue'
import { applyPatch } from 'fast-json-patch';
import App from './App.vue'
import router from './router'

export const state = ref({
	disks: [],
	tasks: [],
	connecting: true,
	connected: false,
	tarallo: {
		available: false
	},
	features:{}
});

let eventStream = new EventSource("/api/v1/stream");
eventStream.onmessage = (event) => {
	let parsed;
	try {
		parsed = JSON.parse(event.data);
	} catch (err) {
		// TODO display an error
		console.log(err);
		return;
	}
	if (Array.isArray(parsed)) { // means that this is a partial update
		applyPatch(state.value, parsed);
	} else {
		state.value.disks = parsed.disks;
		state.value.tasks = parsed.tasks;
		state.value.tarallo = parsed.tarallo;
	}
};
eventStream.onopen = () => {
	// TODO display successfull connection
	state.value.connecting = false;
	state.value.connected = true;
};
eventStream.onerror = (err) => {
	console.log(err);
	state.value.connecting = false;
	// TODO display some kind of error
};

fetch("/api/v1/tarallo/features.json").then(async res => {
	if (res.status - 300 >= 0) {
		console.log("WARNING: Tarallo features not available");
	} else {
		state.value.features = await res.json();
	}
});

const app = createApp(App, {foo: "woop"});

app.use(router);

app.mount('#app');
