<script lang="ts">
  import Icon from "$lib/Icon.svelte";
  import SiteFooter from "$lib/SiteFooter.svelte";
</script>

<svelte:head><title>About · Fact Friends</title><meta name="description" content="Fact Friends is a free classroom tool from the EdTech-a-thon." /></svelte:head>

<main class="doc-page">
  <a class="brand" href="/" aria-label="Fact Friends home"><span class="brand-mark">+</span><span>Fact Friends</span></a>
  <article class="doc">
    <a class="back-link" href="/"><Icon name="arrow-left" size={14} /> Back to Fact Friends</a>
    <h1>About</h1>
    <p class="intro">Friendly math fact practice, built for teachers and their students.</p>

    <section class="setup-section">
      <div class="doc-heading"><img src="/edtechathon-logo.svg" alt="" width="40" height="40" /><h2>From the EdTech-a-thon</h2></div>
      <p>Fact Friends is a project from the <a href="https://edtechathon.com" target="_blank" rel="noopener noreferrer">EdTech-a-thon</a>, a community of builders making free tools for classrooms. Learn more about who we are and what else we're building at <a href="https://edtechathon.com" target="_blank" rel="noopener noreferrer">edtechathon.com</a>.</p>
      <figure class="doc-photo">
        <img src="/2026participants.jpg" alt="Participants of the 2026 EdTech-a-thon" />
        <figcaption>EdTech-a-thon 2026</figcaption>
      </figure>
    </section>

    <section class="setup-section">
      <h2>Our promise</h2>
      <ul class="doc-promise">
        <li><strong>Zero paywalls.</strong></li>
        <li><strong>Zero ads.</strong></li>
        <li><strong>Zero selling of student data.</strong></li>
      </ul>
    </section>

    <section class="setup-section">
      <h2>Feedback &amp; ideas</h2>
      <p>We'd love to hear from you. Tell us what's working, what's not, or pitch us an idea for a tool you wish existed. We're here to help.</p>
      <a class="doc-mail" href="mailto:support@factfriends.com?subject=factfriends%20feedback">Email dsupport@factfriends.com</a>
    </section>
  </article>
  <SiteFooter />
</main>
