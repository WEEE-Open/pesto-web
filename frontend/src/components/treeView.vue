<script setup>
import { computed } from 'vue';

const props = defineProps({tree: Object});

const treeList = computed(() => {
	return Object.entries(props.tree);
});

</script>
<template>
<ul>
	<li v-for="[key, value] in treeList">
		{{ key }}
	</li>
</ul>
</template>