<script lang="ts">
  import { goto } from "$app/navigation";
  import Icon from "$lib/Icon.svelte";
  import SiteFooter from "$lib/SiteFooter.svelte";

  let mode: "sign-in" | "sign-up" = "sign-in";
  let name = "";
  let email = "";
  let password = "";
  let error = "";
  let pending = false;

  async function submit() {
    error = "";
    if (mode === "sign-up" && !name.trim()) { error = "Enter your name."; return; }
    if (password.length < 8) { error = "Choose a password with at least 8 characters."; return; }
    pending = true;
    try {
      const response = await fetch("/api/teacher-auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, name, email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      await goto("/teacher/home");
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "We could not complete that request.";
    } finally { pending = false; }
  }
</script>

<main class="with-footer">
  <a class="brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <section class="join-card teacher-card" aria-labelledby="teacher-title">
    <a class="back-link" href="/"><Icon name="arrow-left" size={14} /> Student sign in</a><div class="icon teacher-icon"><Icon name="graduation-cap" size={26} /></div><p class="eyebrow">TEACHER DESK</p><h1 id="teacher-title">Teacher account</h1><p class="intro">Sign in or create an account.</p>
    <div class="tabs"><button type="button" class:active={mode === "sign-in"} on:click={() => { mode = "sign-in"; error = ""; }}>Sign in</button><button type="button" class:active={mode === "sign-up"} on:click={() => { mode = "sign-up"; error = ""; }}>Create account</button></div>
    <form on:submit|preventDefault={submit}>
      {#if mode === "sign-up"}<label for="name">Your name</label><input id="name" bind:value={name} autocomplete="name" placeholder="For example, Taylor Morgan" required />{/if}
      <label for="email">Email address</label><input id="email" bind:value={email} type="email" autocomplete="email" placeholder="teacher@school.org" required />
      <label for="password">Password</label><input id="password" bind:value={password} type="password" autocomplete={mode === "sign-in" ? "current-password" : "new-password"} minlength="8" placeholder="At least 8 characters" required />
      {#if error}<p class="message error" role="alert">{error}</p>{/if}
      <button type="submit" disabled={pending}>{pending ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"} <span><Icon name="arrow-right" size={17} /></span></button>
    </form>
  </section>
  <SiteFooter />
</main>
