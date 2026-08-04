<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import { forgetStudent, readRememberedStudent, type RememberedStudent } from "$lib/rememberedStudent";

  export let data: { prefill: string; error?: string };
  export let form: { prefill?: string; error?: string } | null = null;

  let classCode = form?.prefill ?? data.prefill ?? "";
  let pending = false;
  let remembered: RememberedStudent | null = null;
  $: errorMessage = form?.error ?? data.error ?? "";

  onMount(() => {
    remembered = readRememberedStudent();
  });

  function notMe() {
    forgetStudent();
    remembered = null;
  }
</script>

<main>
  <a class="brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <section class="join-card" aria-labelledby="join-title">
    {#if remembered}
      <div class="icon"><Icon name="smile" size={26} /></div>
      <p class="eyebrow">WELCOME BACK</p>
      <h1 id="join-title">Hi, {remembered.name}!</h1>
      <p class="intro">Pick up right where you left off{remembered.className ? ` in ${remembered.className}` : ""}.</p>
      <a class="button-link" href="/join/{remembered.classCode}">Continue <span><Icon name="arrow-right" size={17} /></span></a>
      <p class="help">Not you? <a href="/" on:click|preventDefault={notMe}>Use a different class code</a></p>
    {:else}
    <div class="icon"><Icon name="smile" size={26} /></div><p class="eyebrow">STUDENT SIGN IN</p><h1 id="join-title">Join your class</h1><p class="intro">Enter the class code your teacher gave you.</p>
    <form method="POST" use:enhance={() => { pending = true; return async ({ update }: { update: () => Promise<void> }) => { await update(); pending = false; }; }}>
      <label for="class-code">Class code</label>
      <input id="class-code" name="classCode" bind:value={classCode} inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Class code" />
      {#if errorMessage}<p class="message error" role="alert">{errorMessage}</p>{/if}
      <button type="submit" disabled={pending}>{pending ? "Checking..." : "Continue"} <span><Icon name="arrow-right" size={17} /></span></button>
    </form>
    <p class="help">Are you a teacher? <a href="/teacher">Sign in or create an account.</a></p>
    {/if}
  </section>
</main>
