<script lang="ts">
  import "../app.css";
  import Toast from "$lib/Toast.svelte";
</script>

<svelte:head><title>Fact Friends</title><meta name="description" content="Friendly math fact practice" /><link rel="icon" href="/favicon.svg" /></svelte:head>
<slot />
<Toast />
