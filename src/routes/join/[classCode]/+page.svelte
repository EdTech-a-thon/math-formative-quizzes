<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import { forgetStudent, readRememberedStudent, rememberStudent } from "$lib/rememberedStudent";

  export let data: { classCode: string; className: string };
  export let form: { joined?: boolean; studentName?: string; className?: string; name?: string; error?: string } | null = null;

  let name = form?.name ?? "";
  // Ticked by default: most students sign in on their own device, and the ones
  // who share can untick it.
  let remember = true;
  let pending = false;

  // A student already remembered for this class gets their name filled in, so
  // signing back in is a single tap.
  onMount(() => {
    const saved = readRememberedStudent();
    if (!saved || saved.classCode !== data.classCode) return;
    if (!name) name = saved.name;
  });

  // Save (or clear) the device once the join actually succeeds.
  $: if (form?.joined) {
    if (remember) rememberStudent({ classCode: data.classCode, className: form.className ?? data.className, name: form.studentName ?? name });
    else forgetStudent();
  }
</script>

<main>
  <a class="brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <section class="join-card" aria-labelledby="name-title">
    {#if form?.joined}
      <div class="icon"><Icon name="check" size={26} /></div>
      <p class="eyebrow">YOU'RE IN</p>
      <h1 id="name-title">Welcome, {form.studentName}!</h1>
      <p class="intro">You've joined {form.className}. Your teacher will get you started with your first quiz.</p>
      <p class="help">Not you? <a href="/" on:click={forgetStudent}>Start over</a></p>
    {:else}
      <div class="icon"><Icon name="smile" size={26} /></div>
      <p class="eyebrow">JOIN {data.className.toUpperCase()}</p>
      <h1 id="name-title">What's your name?</h1>
      <p class="intro">Enter your first and last name to join {data.className}.</p>
      <form method="POST" use:enhance={() => { pending = true; return async ({ update }: { update: () => Promise<void> }) => { await update(); pending = false; }; }}>
        <label for="student-name">Your name</label>
        <input id="student-name" name="name" bind:value={name} autocomplete="name" placeholder="First and last name" />
        <label class="remember-row" for="remember-me">
          <input id="remember-me" type="checkbox" bind:checked={remember} />
          <span>Remember me on this device</span>
        </label>
        {#if form?.error}<p class="message error" role="alert">{form.error}</p>{/if}
        <button type="submit" disabled={pending}>{pending ? "Joining..." : "Join class"} <span><Icon name="arrow-right" size={17} /></span></button>
      </form>
      <p class="help">Wrong class? <a href="/">Enter a different code</a></p>
    {/if}
  </section>
</main>
