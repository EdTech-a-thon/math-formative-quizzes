<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { dismissToast, toasts } from "$lib/toasts";
</script>

<!-- One stack for the whole app, mounted once in the root layout. -->
{#if $toasts.length}
  <div class="toast-stack" role="region" aria-label="Notifications">
    {#each $toasts as toast (toast.id)}
      <div class="toast toast-{toast.kind}" role={toast.kind === "error" ? "alert" : "status"}>
        <span class="toast-mark"><Icon name={toast.kind === "error" ? "circle-dot" : "check"} size={15} /></span>
        <div class="toast-body">
          <strong>{toast.message}</strong>
          {#if toast.detail}<small>{toast.detail}</small>{/if}
        </div>
        <button type="button" class="toast-close" aria-label="Dismiss" on:click={() => dismissToast(toast.id)}>
          <Icon name="x" size={14} />
        </button>
      </div>
    {/each}
  </div>
{/if}
