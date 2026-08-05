<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";

  // One button for both kinds of file: the endpoint reads what the PDF carries,
  // so importing a progression from the quiz library works just as well.
  export let classId: string;
  export let label = "Import PDF";
  export let onResult: (message: string, ok: boolean) => void = () => {};

  let input: HTMLInputElement;
  let busy = false;

  async function chosen() {
    const file = input.files?.[0];
    if (!file) return;
    busy = true;
    try {
      const body = new FormData();
      body.append("class", classId);
      body.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      onResult(
        result.kind === "progression"
          ? `Imported “${result.title}” and its ${result.quizzes} quiz${result.quizzes === 1 ? "" : "zes"}.`
          : `Imported “${result.title}”.`,
        true,
      );
      await invalidateAll();
    } catch (caught) {
      onResult(caught instanceof Error ? caught.message : "We could not import that PDF.", false);
    } finally {
      busy = false;
      input.value = ""; // Clearing it means picking the same file again still counts.
    }
  }
</script>

<button type="button" class="ghost-btn" disabled={busy} on:click={() => input.click()}>
  <Icon name="download" size={14} /> {busy ? "Importing…" : label}
</button>
<input class="sr-only" type="file" accept="application/pdf,.pdf" bind:this={input} on:change={chosen} />
