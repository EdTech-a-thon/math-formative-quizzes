<script lang="ts">
  import { icons, type IconName } from "$lib/icons";
  export let name: IconName;
  export let size = 20;
  export let stroke = 2;
</script>

<svg
  class="ui-icon"
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>{@html icons[name]}</svg>

<style>
  .ui-icon { display: inline-block; flex: 0 0 auto; vertical-align: -0.14em; }
</style>
