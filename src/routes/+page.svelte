<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import SiteFooter from "$lib/SiteFooter.svelte";
  import HomeHero from "$lib/HomeHero.svelte";
  import { enhance } from "$app/forms";

  export let data: { prefill: string; error?: string };
  export let form: { prefill?: string; error?: string } | null = null;

  let classCode = form?.prefill ?? data.prefill ?? "";
  let pending = false;
  $: errorMessage = form?.error ?? data.error ?? "";
</script>

<svelte:head><title>Fact Friends · Math facts your class can grow with</title><meta name="description" content="Choose ready-made math-fact quizzes, invite students with a class code, and see how your class is doing." /></svelte:head>

<main class="landing-page">
  <header class="landing-header">
    <a class="landing-brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
    <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#join-class">Join a class</a><a class="landing-create-account" href="/teacher?mode=sign-up">Create account</a><a class="landing-sign-in" href="/teacher">Teacher sign in</a></nav>
  </header>

  <section class="landing-hero" aria-labelledby="hero-title">
    <div class="landing-hero-copy"><p class="eyebrow">MATH FACTS, MADE FRIENDLY</p><h1 id="hero-title">Simple progress tracking for math-facts quizzes</h1><p class="landing-lede">Start with ready-made quizzes for addition, subtraction, multiplication, and division. Assign the right practice to each student, then see their scores and progress.</p>
      <form id="join-class" class="landing-hero-form" method="POST" use:enhance={() => { pending = true; return async ({ update }: { update: () => Promise<void> }) => { await update(); pending = false; }; }}><label for="class-code">Your class code</label><div class="landing-code-row"><input id="class-code" name="classCode" bind:value={classCode} inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Six-digit code" /><button type="submit" disabled={pending}>{pending ? "Checking..." : "Join class"} <Icon name="arrow-right" size={16} /></button></div>{#if errorMessage}<p class="message error" role="alert">{errorMessage}</p>{/if}</form>
      <p class="landing-cta-note">Your teacher will give you a class code to join.</p>
    </div>
    <HomeHero />
  </section>

  <section class="landing-how" id="how-it-works" aria-labelledby="how-title"><div class="landing-section-inner"><p class="eyebrow">A SIMPLE START</p><h2 id="how-title">How it works</h2><div class="landing-steps">
    <article><span>1</span><h3>Choose a practice path</h3><p>Pick ready-made math facts or make your own quizzes for the class.</p></article>
    <article><span>2</span><h3>Invite your students</h3><p>Share a class code, then assign each learner the practice they need.</p></article>
    <article><span>3</span><h3>See their progress</h3><p>Follow quiz scores and decide when to release the next attempt.</p></article>
  </div></div></section>

  <section class="landing-student" aria-labelledby="join-title"><div class="landing-student-copy"><p class="eyebrow">FOR STUDENTS</p><h2 id="join-title">Join your class and start practising.</h2><p>Your teacher will give you a class code. Enter it above to see the practice waiting for you.</p><a href="#join-class">Enter your class code <Icon name="arrow-right" size={16} /></a></div></section>

  <section class="landing-privacy" aria-labelledby="privacy-title"><div><p class="eyebrow">WHERE YOUR WORK LIVES</p><h2 id="privacy-title">Class work stays with your class.</h2><p>Class rosters, quiz answers, and scores are stored in Fact Friends’ private classroom database so teachers can see progress across devices. Unsaved quiz drafts stay on the device where they were made. We do not use student data for advertising.</p><a href="/privacy">Read our privacy details <Icon name="arrow-right" size={15} /></a></div></section>
  <SiteFooter />
</main>
