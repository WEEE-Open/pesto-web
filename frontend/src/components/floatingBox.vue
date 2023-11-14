<script setup>
import cross from './icons/cross.vue';
</script>
<template>
	<div class="box">
		<h1 class="title"><slot name="title"></slot></h1>
		<RouterLink to="/"><cross size="48"></cross></RouterLink>
		<div class="main"><slot></slot></div>
	</div>
</template>
<style scoped>
.box {
	position: fixed;
	top: 0;
	bottom: 0;
	left: 0;
	right: 0;
	margin: auto;
	display: grid;
	grid-template-columns: 1fr auto;
	grid-template-rows: auto 1fr;
	grid-template-areas: "title close" "main main" ;
	max-height: 700px;
	max-width: 1200px;
	background: var(--color-background-mute);
	padding: 40px;
}

.title {
	grid-area: title;
	display: flex;
	gap: 16px;
}
.main {
	grid-area: main;
	overflow: auto;
}
</style>