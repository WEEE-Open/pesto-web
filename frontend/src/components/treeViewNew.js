import { h } from "vue";

export default {
	props: ["tree"],
	data() {
		return {};
	},
	render() {
		return h(objectList);
	}
}


export const objectList = {
	props: ["tree"],
	data() {
		return {};
	},
	render() {
		return h("div", "test");
	}
}


export const arrayList = {
	props: ["tree"],
	data() {
		return {};
	},
	render() {
		return h("div", "test");
	}
}
