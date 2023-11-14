<script setup>
import { computed, ref } from 'vue';
import { state } from '../main';
import { getTaralloFeatureName } from '../utils';
import { useRoute } from 'vue-router';
import Overlay from '../components/overlay.vue';
import FloatingBox from '../components/floatingBox.vue';
import ssd from '../components/icons/ssd.vue';
import hdd from '../components/icons/hdd.vue';
import treeViewNew from '../components/treeViewNew';
//import TreeView from '../components/treeView.vue';

const commonKeys = ref([]);

const disk = computed(() => {
	let route = useRoute();
	let d = state.value.disks.find(d => d.name === route.params.name);
	if (d === undefined) return undefined;
	commonKeys.value = [...Object.keys(d?.taralloProperties?.features || {}), ...Object.keys(d.parsedSmartData || {})].filter((v, i, a) => a.indexOf(v) === i);
	return d;
});

const upload = () => {
	fetch('/api/v1/disks/' + encodeURIComponent(disk.value.name) + '/tarallo', {
		method: 'POST',
	}).then(res => {return res.text()}).then(alert);
};

// TODO: add display of current task if busy

</script>
<template>
	<Overlay></Overlay>
	<FloatingBox v-if=disk>
		<template #title>
			<ssd size="48" class="icon" v-if="disk?.icon == 'ssd'"/>
			<hdd size="48" class="icon" v-else />
			{{ disk.name }}
		</template>
		<div v-if=disk.size><b>Size: </b> {{ disk.size }} </div>
		<div v-if=disk.code><b>Code: </b> {{ disk.code }} </div>
		<div class="title">
			<h2>Disk properties</h2>
			<button v-if=disk.code class="button">Update</button>
			<button v-else class="button" @click=upload>Upload</button>
		</div>
		<div v-if=disk.taralloProperties>
			<table>
				<thead>
					<tr>
						<th></th>
						<th>S.M.A.R.T.</th>
						<th v-if="disk?.taralloProperties?.features">Tarallo</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="key in commonKeys">
						<td>{{ getTaralloFeatureName(key) }}</td>
						<td>{{ disk?.parsedSmartData[key] }}</td>
						<td v-if="disk?.taralloProperties?.features">{{ disk?.taralloProperties.features[key] }}</td>
					</tr>
				</tbody>
			</table>
		</div>
		<div v-else>
			<i>No properties</i>
		</div>
		<div><treeViewNew :tree="disk.smartData" /></div>
		{{ JSON.stringify(disk) }}
	</FloatingBox>
</template>
<style scoped>

.title {
	display: grid;
	grid-template-columns: 1fr auto;
	grid-template-rows: auto;
	grid-template-areas: "title button";
}

.title h2 {
	grid-area: title;

}
.button {
	border: none;
	outline: none;
	border-radius: 0;
	background-color: var(--color-background-soft);
	color: var(--color-text);
	grid-area: button;
	padding: 8px 16px;
	margin: 0 8px;
	cursor: pointer;
	z-index: 50000;
}

table {
	width: 100%;
	border-spacing: 0;
}

table thead {
	font-size: 16px;
	font-weight: bold;
	background-color: var(--color-background);
}

table tbody tr:nth-child(odd) {
	background-color: var(--color-background-soft);
}

table tbody tr:hover {
	background-color: var(--color-border);
}

table td, th {
	padding: 8px;
}
</style>