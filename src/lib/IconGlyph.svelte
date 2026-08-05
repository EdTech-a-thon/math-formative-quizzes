<script lang="ts">
  // Draws a teacher-chosen icon, falling back to one of the app's own glyphs
  // when nothing has been picked (or the saved name is no longer in the set).
  import { icons, type IconName } from "$lib/icons";
  import { pickerIcons } from "$lib/pickerIcons";

  export let name: string | null | undefined = null;
  export let fallback: IconName = "circle-dot";
  export let size = 20;
  export let stroke = 2;

  $: markup = (name && pickerIcons[name]) || icons[fallback];
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
>{@html markup}</svg>

<style>
  .ui-icon { display: inline-block; flex: 0 0 auto; vertical-align: -0.14em; }
</style>
