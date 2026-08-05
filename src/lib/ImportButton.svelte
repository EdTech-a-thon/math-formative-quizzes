<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import ImportDialog from "$lib/ImportDialog.svelte";

  export let classId: string;
  export let label = "Import";

  let open = false;
</script>

<button type="button" class="ghost-btn" on:click={() => (open = true)}>
  <Icon name="download" size={14} /> {label}
</button>

{#if open}
  <ImportDialog {classId} onClose={() => (open = false)} />
{/if}
