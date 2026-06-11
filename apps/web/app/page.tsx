// Placeholder landing / onboarding (Phase 0, DESIGN.md §6).
// Real flow: anonymous start → Cyrillic onboarding (gated on alphabet fluency) →
// the "order a drink" scenario, run through listen → speak (dual-ASR feedback) →
// scaffolded spoken conversation. The speaking + tutor logic comes from @ll/core (ported spike).
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "10vh auto", padding: 24 }}>
      <h1>Macedonian — start talking</h1>
      <p>
        Scaffold. Wire onboarding and the <code>order-a-drink</code> scenario here. The speaking
        pipeline and tutor loop are ported from <code>spike/</code> into <code>@ll/core</code>.
      </p>
    </main>
  );
}
