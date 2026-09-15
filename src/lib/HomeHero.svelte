<figure class="home-illustration" aria-label="A student practices multiplication while a teacher checks class progress">
  <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
  <div class="math-tag tag-add">addition <b>+</b></div>
  <div class="math-tag tag-divide">division <b>÷</b></div>
  <div class="practice-sheet">
    <div class="sheet-top"><span class="sheet-icon">×</span><span>STUDENT PRACTICE</span><span class="sheet-step">STEP 5 OF 13</span></div>
    <h2>Multiply by 5</h2>
    <p>A short quiz for the next step. You’ve got this!</p>
    <div class="question"><span>5 × 4 =</span><strong>20</strong><span class="answer-check">✓</span></div>
    <div class="sheet-bottom"><span>Question 7 of 25</span><span class="mini-progress"><i></i></span></div>
  </div>
  <div class="teacher-peek"><div><span class="teacher-peek-icon">✓</span><span><small>TEACHER VIEW</small><strong>See how they're doing</strong></span></div><p>Math facts, scores, and the next step in one place.</p></div>
  <figcaption class="visually-hidden">Fact Friends gives students a quiz and teachers a view of their progress.</figcaption>
</figure>

<style>
  .home-illustration { position: relative; display: grid; width: min(100%, 520px); min-height: 470px; place-items: center; margin: 0 auto; isolation: isolate; }
  .home-illustration::before { content: ""; position: absolute; inset: 9% 2% 6%; z-index: -2; border-radius: 50%; background: #eee7ff; }
  .orbit { position: absolute; z-index: -1; border: 1px dashed #c8b9eb; border-radius: 50%; transform: rotate(-13deg); }
  .orbit-one { inset: 2% 0 0 0; }.orbit-two { inset: 18% 13% 17%; }
  .math-tag { position: absolute; z-index: 2; display: flex; align-items: center; gap: 10px; border: 1px solid #e9e4df; border-radius: 10px; padding: 8px 10px; background: #fffdfa; box-shadow: 0 9px 25px #392a5a18; color: #625a76; font-size: .76rem; font-weight: 900; transform: rotate(-5deg); }
  .math-tag b { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 7px; background: #fff0df; color: #c46a19; font-size: 1.1rem; }
  .tag-add { top: 13%; left: 1%; }.tag-divide { top: 15%; right: 0; transform: rotate(5deg); }.tag-divide b { background: #e5f4fb; color: #2a83b8; }
  .practice-sheet { width: min(72%, 360px); min-width: 265px; margin: -30px 10px 0 0; border: 1px solid #e3dceb; border-radius: 16px; padding: 23px; background: #fffdfa; box-shadow: 0 28px 60px #392a5a25; transform: rotate(2deg); }
  .sheet-top { display: flex; align-items: center; gap: 7px; color: #8a8399; font-size: .62rem; font-weight: 900; letter-spacing: .08em; }
  .sheet-icon { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 7px; background: #eee9ff; color: #6748d1; font-size: 1.1rem; letter-spacing: 0; }
  .sheet-step { margin-left: auto; color: #6748d1; white-space: nowrap; }
  h2 { margin: 24px 0 5px; color: #26233a; font-family: Fraunces, Georgia, serif; font-size: 1.65rem; letter-spacing: -.04em; }
  p { margin: 0; color: #81799a; font-size: .78rem; line-height: 1.5; }
  .question { display: flex; align-items: center; gap: 9px; margin-top: 22px; border: 1px solid #ded5f5; border-radius: 11px; padding: 16px 12px; background: #faf8ff; color: #332c48; font-family: Fraunces, Georgia, serif; font-size: 1.65rem; }
  .question strong { margin-left: auto; color: #6748d1; }.answer-check { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 50%; background: #e9f7eb; color: #32835d; font-family: sans-serif; font-size: .9rem; }
  .sheet-bottom { display: flex; align-items: center; gap: 12px; margin-top: 18px; color: #81799a; font-size: .67rem; font-weight: 800; }
  .mini-progress { width: 80px; height: 6px; margin-left: auto; border-radius: 5px; background: #eee9ff; }.mini-progress i { display: block; width: 28%; height: 100%; border-radius: inherit; background: #7456e8; }
  .teacher-peek { position: absolute; right: 3%; bottom: 11%; width: min(68%, 290px); border: 1px solid #e9e4df; border-radius: 13px; padding: 13px 16px; background: #fffdfa; box-shadow: 0 14px 35px #392a5a25; transform: rotate(-4deg); }
  .teacher-peek > div { display: flex; align-items: center; gap: 9px; }.teacher-peek-icon { display: grid; width: 31px; height: 31px; place-items: center; border-radius: 9px; background: #e9f7eb; color: #32835d; font-weight: 900; }
  .teacher-peek small, .teacher-peek strong { display: block; }.teacher-peek small { color: #81799a; font-size: .55rem; font-weight: 900; letter-spacing: .1em; }.teacher-peek strong { margin-top: 2px; color: #26233a; font-size: .8rem; }.teacher-peek p { margin: 8px 0 0; font-size: .7rem; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
  @media (max-width: 540px) { .home-illustration { min-height: 370px; }.practice-sheet { min-width: 240px; padding: 17px; }.tag-add { left: 0; }.tag-divide { right: 0; }.teacher-peek { right: 0; bottom: 8%; } }
</style>
