<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import { enhance } from "$app/forms";

  export let data: { classCode: string; className: string };
  export let form: { name?: string; error?: string } | null = null;

  let name = form?.name ?? "";
  let pending = false;
</script>

<main>
  <a class="brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <section class="join-card" aria-labelledby="name-title">
    <div class="icon"><Icon name="smile" size={26} /></div>
    <p class="eyebrow">JOIN {data.className.toUpperCase()}</p>
    <h1 id="name-title">What's your name?</h1>
    <p class="intro">Enter your first and last name to join {data.className}.</p>
    <form method="POST" use:enhance={() => { pending = true; return async ({ update }: { update: () => Promise<void> }) => { await update(); pending = false; }; }}>
      <label for="student-name">Your name</label>
      <input id="student-name" name="name" bind:value={name} autocomplete="name" placeholder="First and last name" />
      <label class="remember-row" for="remember-me">
        <input id="remember-me" name="remember" type="checkbox" checked />
        <span>Remember me on this device</span>
      </label>
      {#if form?.error}<p class="message error" role="alert">{form.error}</p>{/if}
      <button type="submit" disabled={pending}>{pending ? "Joining..." : "Join class"} <span><Icon name="arrow-right" size={17} /></span></button>
    </form>
    <p class="help">Wrong class? <a href="/">Enter a different code</a></p>
  </section>
</main>
