<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { enhance } from "$app/forms";

  export let data: { prefill: string; error?: string };
  export let form: { prefill?: string; error?: string } | null = null;

  let classCode = form?.prefill ?? data.prefill ?? "";
  let pending = false;
  $: errorMessage = form?.error ?? data.error ?? "";
</script>

<main>
  <a class="brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <section class="join-card" aria-labelledby="join-title">
    <div class="icon"><Icon name="smile" size={26} /></div><p class="eyebrow">STUDENT SIGN IN</p><h1 id="join-title">Join your class</h1><p class="intro">Enter the class code your teacher gave you.</p>
    <form method="POST" use:enhance={() => { pending = true; return async ({ update }: { update: () => Promise<void> }) => { await update(); pending = false; }; }}>
      <label for="class-code">Class code</label>
      <input id="class-code" name="classCode" bind:value={classCode} inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Class code" />
      {#if errorMessage}<p class="message error" role="alert">{errorMessage}</p>{/if}
      <button type="submit" disabled={pending}>{pending ? "Checking..." : "Continue"} <span><Icon name="arrow-right" size={17} /></span></button>
    </form>
    <p class="help">Are you a teacher? <a href="/teacher">Sign in or create an account.</a></p>
  </section>
</main>
