<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { state } from './main';
import ssd from './components/icons/ssd.vue';
import hdd from './components/icons/hdd.vue';

</script>

<template>
	<div class="main-container">
		<div class="server-status" v-if="state.connected">
			Connected
			<span v-if="state?.tarallo?.available"> - Tarallo is available</span>
		</div>
		<div v-show="state.connecting" class="server-status">
			<div class="spinner"></div>
			Connecting...
		</div>
		<div class="main">
			<div>
				<i v-if="state.disks.length == 0" class="center">No disks detected</i>
				<ul v-else class="list">
					<RouterLink v-for="disk in state.disks" :to="`/disk/${encodeURIComponent(disk.name)}`">
						<li class="disk">
							<ssd size="48" class="icon" v-if="disk.icon == 'ssd'"/>
							<hdd size="48" class="icon" v-else />
							<div class="name">{{ disk.name }}</div>
							<div class="code-size"><span class="code">{{ disk.code }}</span> {{ disk.size != null && disk.code != null ? '-' : '' }} {{ disk.size }}</div>
						</li>
					</RouterLink>
				</ul>
			</div>
			<div class="divider"></div>
			<div>
				<i v-if="state.tasks.length == 0" class="center">No tasks in queue</i>
				<ul v-else class="list">
					<RouterLink v-for="task in state.tasks" :to="`/task/${encodeURIComponent(disk.name)}`">
						<li>
							{{ task.name }}
						</li>
					</RouterLink>
				</ul>
			</div>
		</div>
	</div>
	<RouterView />
</template>

<style scoped>
.server-status {
	position: absolute;
	top: 10px;
	right: 10px;
	z-index: 20000;
}

.spinner {
	height: 20px;
	width: 20px;
	border-radius: 10px;
	border-top: solid 5px var(--color-text);
	border-right: solid 5px transparent;
	border-bottom: solid 5px var(--color-text);
	border-left: solid 5px transparent;
    animation-name: rotate;
    animation-iteration-count: infinite;
    animation-duration: 1s;
	display: inline-block;
	translate: 0 5px;
}

@keyframes rotate {
    from {transform: rotate(0deg) scale(1); border-color:  var(--color-text) transparent;}
    50% {transform: rotate(180deg) scale(0.9); border-color: var(--color-accent) transparent;}
    to {transform: rotate(360deg); border-color:  var(--color-text) transparent;}
}
.main-container {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	height: 100%;
}
.server-status{
	position: absolute;
	top: 10px;
	left: 20px;
	z-index: 20000;
}
.main {
	display: grid;
	width: 100%;
	height: 100%;
	max-width: 1000px;
	max-height: 600px;
	grid-template-columns: 1fr 1px 1fr;
	gap: 20px;
	padding: 20px;
	background: var(--color-background-soft);
}

.divider {
	height: 100%;
	width: 1px;
	background: var(--color-border);
}

.center {
	display: flex;
	align-items: center;
	height: 100%;
	justify-content: center;
}

.list {
	padding: 5px 0;
	list-style: none;
}

.list li {
	padding: 10px;
}

.list li:hover {
	background: var(--color-background-mute);
	outline: 1px solid var(--color-border)
}

.disk {
	display: grid;
	grid-template-columns: 48px 1fr auto;
	grid-template-rows: 1fr 1fr;
	grid-template-areas: "icon name code" "icon status flags" ;
	gap: 10px;
}

.disk .icon {
	grid-area: icon;
	justify-self: center;
	align-self: center;
}

.disk .name {
	grid-area: name;
	color: var(--color-heading)
}

.disk .code-size {
	grid-area: code;
	justify-self: end;
}

.disk .code {
	color: var(--color-accent);
}

.disk .status {
	grid-area: status;
}

.disk .flags {
	grid-area: flags;
	justify-self: end;
}
</style>
