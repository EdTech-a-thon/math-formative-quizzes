<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import SiteFooter from "$lib/SiteFooter.svelte";
</script>

<svelte:head><title>Privacy · Fact Friends</title><meta name="description" content="What Fact Friends collects, what it doesn't, and why." /></svelte:head>

<main class="doc-page">
  <a class="brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <article class="doc">
    <a class="back-link" href="/"><Icon name="arrow-left" size={14} /> Back to Fact Friends</a>
    <h1>Privacy</h1>
    <p class="intro">What we collect, what we don't, and why.</p>

    <section class="setup-section">
      <h2>What teachers and students give us</h2>
      <p>Fact Friends needs a small amount of information to work as a classroom tool. A teacher account stores the teacher's name and email address. When a teacher builds a roster, we store each student's name, the login name the student types to join, and their chosen profile icon and colour. As students work, we store their quiz answers, scores, and level so that teachers can see how the class is doing.</p>
      <p>Students never give us an email address or a password &mdash; they join with a class code and their name. We do not ask any student for personal information beyond what their teacher has put on the roster.</p>
    </section>

    <section class="setup-section">
      <h2>What we never do</h2>
      <p>We do not sell, share, or otherwise transfer teacher or student data to third parties, and we never use it for advertising. A teacher only ever sees their own classes. Deleting a class or a student removes their quiz history along with it.</p>
    </section>

    <section class="setup-section">
      <h2>Analytics</h2>
      <p>We use Cloudflare Web Analytics to anonymously count visits, which helps us understand how Fact Friends is being used in classrooms. Cloudflare Web Analytics is cookieless, does not fingerprint visitors, and does not track users across other sites &mdash; see Cloudflare's <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">privacy policy</a> for details.</p>
    </section>

    <section class="setup-section">
      <h2>On your device</h2>
      <p>We set a sign-in cookie so teachers and students stay signed in, and we keep a couple of things in your browser's local storage: the countdown on a timed quiz, so it survives a refresh, and unsaved quiz drafts a teacher is still editing. That information stays on the device.</p>
      <p>Questions or concerns? Email <a href="mailto:directors@edtechathon.com?subject=factfriends%20privacy">directors@edtechathon.com</a>.</p>
    </section>
  </article>
  <SiteFooter />
</main>
