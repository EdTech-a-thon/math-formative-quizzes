<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";
  import { pushToast } from "$lib/toasts";

  // One button for every shape of import: a PDF from an Export button, or the
  // JSON record on its own. The endpoint reads what it holds, so importing a
  // progression from the quiz library works just as well as a quiz.
  export let classId: string;
  export let label = "Import";

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
      // A failure here can be an error page rather than JSON, so a broken parse
      // must not turn into a confusing "undefined" on screen.
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        pushToast(
          "error",
          result.message || `We could not import ${file.name}.`,
          result.detail || "Please try again, or export the file fresh.",
        );
        return;
      }

      pushToast(
        "success",
        result.kind === "progression"
          ? `Imported “${result.title}” and its ${result.quizzes} quiz${result.quizzes === 1 ? "" : "zes"}.`
          : `Imported “${result.title}”.`,
      );
      await invalidateAll();
    } catch (caught) {
      // Nothing came back at all — the request never landed.
      pushToast(
        "error",
        `We could not import ${file.name}.`,
        caught instanceof Error && caught.message ? caught.message : "Check your connection and try again.",
      );
    } finally {
      busy = false;
      input.value = ""; // Clearing it means picking the same file again still counts.
    }
  }
</script>

<button type="button" class="ghost-btn" disabled={busy} on:click={() => input.click()}>
  <Icon name="download" size={14} /> {busy ? "Importing…" : label}
</button>
<input class="sr-only" type="file" accept="application/pdf,.pdf,application/json,.json" bind:this={input} on:change={chosen} />
