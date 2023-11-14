import { toRaw } from 'vue';
import { state } from './main';


export function getTaralloFeatureName(feature) {
	if (state.value.features?.features === undefined) return feature;
	// TODO: this is shit, fix it
	return Object.values(toRaw(state.value.features.features)).flat().find(f => f.name === feature)?.printableName ?? feature;
}