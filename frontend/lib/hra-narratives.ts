/**
 * HRA adoption narratives, written by the Plum team.
 *
 * These are used VERBATIM, not regenerated. They are hand-written marketing
 * copy with a deliberate voice; passing them through the copy model would
 * only degrade them. The only substitutions are the recipient's first name
 * and the removal of inline placeholders (<CTA> markers and [image] notes),
 * which the email template renders as a real button instead.
 */
export interface HraNarrative {
  key: string;
  label: string;
  subject: string;
  body: string;
}

const N = (key: string, label: string, subject: string, body: string): HraNarrative =>
  ({ key, label, subject, body: body.trim() });

export const HRA_NARRATIVES: HraNarrative[] = [
  N("curiosity", "Curiosity about your body", "What's your body not telling you?", `
Hey there,

Have you been feeling tired lately, or noticed an ache that comes and goes? Here's the truth: nobody's actually built a way for you to check what those signals mean, until now. Meet your health assessment, right at the center of the new Plum app home.

Ten minutes of your time. What you share stays only with you.

Here's what it actually looks at:
- Family history, habits, the factors that risk your heart health.
- Slept 8 hours, still feel like 4? That's about sleep quality, not just hours.
- The stress you've stopped mentioning hasn't gone anywhere. It's just gotten quieter.
- That ache you've learned to live with? Worth checking.

Plus nutrition, activity levels, and mental wellbeing, three more areas most checkups skip entirely.

What you get on the other side:

A score across all seven areas, so you know exactly where your body needs focus first.

From there, you can set goals to work on areas you'd like to improve.

One minute to kick off your health journey.

With you,
Plum
`),

  N("early-detection", "Early detection", "Catch it before it becomes a problem", `
Hey there,

Most health issues don't show symptoms right away. By the time you notice something's wrong, it's often been building for years. That's what your health assessment is built to catch, early enough to actually do something about it. It's now right at the center of the new Plum app home.

Ten minutes of your time. What you share stays only with you.

Here's what it looks for, years before it becomes a problem:
- Family history and habits that quietly build your heart risk over time.
- Sleep patterns that wear you down long before you'd call it "exhaustion."
- Stress that's stopped feeling urgent, but hasn't stopped adding up.
- Aches that are easy to explain away, until they're not.

Plus nutrition, activity, and mental wellbeing, the three areas most checkups never get to.

What you get on the other side:

A score across all seven areas, flagging what to act on now instead of years from now.

From there, one or two goals built around exactly what your score shows, so you're doing something about it before it's urgent.

Ten questions. The earlier you know, the more you can do about it.

With you,
Plum
`),

  N("personalization", "Personalization", "Generic health advice was never going to work for you", `
Hey there,

Drink more water. Sleep 8 hours. Move more. You've heard it all, and none of it accounts for your actual body. Your health assessment is built to fix that, ten questions that turn into a plan made for you, not a generic one. It's now right at the center of the new Plum app home.

Ten minutes of your time. What you share stays only with you.

Here's what it factors in, specifically for you:
- Your family history and habits, not the average person's.
- Whether your 8 hours are actually resting you, or just passing.
- The stress you've adapted to, measured, not guessed at.
- The ache you've been living with, on record, not ignored.

Plus nutrition, activity levels, and mental wellbeing, tailored to what's true for you, not a checklist.

What you get on the other side:

A score across all seven areas, built from your answers, not a template.

From there, one or two goals chosen because your score points there, not because they're trending.

Ten questions. A plan that's actually about you.

With you,
Plum
`),

  N("social-proof", "Social proof / benchmark", "What does your health score look like next to your team's?", `
Hey there,

Something we noticed: most people vastly overestimate how healthy they are, until they actually check. Less than half of people who take their health assessment score as well as they expected.

That gap is usually the point. Not because anything's wrong, but because nobody had a number to compare against before.

Ten questions gets you yours: heart risk, sleep, stress, aches, nutrition, activity, and mental wellbeing, one score across all seven.

See where you land, then decide if it's worth doing anything about it.

With you,
Plum
`),

  N("free", "Free of cost", "This is already yours, might as well use it", `
Hey there,

Your Plum plan already includes a full health assessment, heart risk, sleep, stress, aches, nutrition, activity, and mental wellbeing, covered, no extra cost, no fine print.

Ten questions, ten minutes, and a score you'd otherwise have no way of getting without paying for a private diagnostic.

With you,
Plum
`),

  N("self-id", "Self-identification / quiz", "Which one sounds like you?", `
Hey there,

You sleep 8 hours and still feel like 4. You've stopped mentioning the stress, it's just background noise now. You've got an ache you've learned to work around instead of fixing. You genuinely don't know your family's heart health history.

If even one of these sounds familiar, your health assessment is worth ten minutes. It covers all of this, plus nutrition, activity, and mental wellbeing, and turns it into one score and a goal or two.

With you,
Plum
`),

  N("myth-busting", "Myth-busting", `"I feel fine" isn't the same as "I'm fine"`, `
Hey there,

Three things people usually get wrong about their own health:

"I'd know if something was off." Not always. High blood pressure, poor sleep quality, and rising stress rarely announce themselves.

"Checkups are for when something's wrong." Most of what your health assessment looks at, heart risk, sleep, stress, aches, nutrition, activity, mental wellbeing, is worth knowing before anything's wrong.

"It'll take forever." Ten questions. That's it.

Your health assessment is right in the new Plum app home, whenever you've got ten minutes.

With you,
Plum
`),

  N("anecdote", "Anecdote-led", "The checkup that would've told him sooner", `
Hey there,

A colleague of ours brushed off feeling tired for months. Just work stress, he figured. Turned out his sleep, his stress, and a family history he'd never really looked at were all pointing the same direction, he just hadn't connected the dots.

That's usually how it goes. Not one big red flag, just a few quiet ones that add up if nobody's looking.

Your health assessment looks at all of them at once. Ten questions, ten minutes, right in the new Plum app home.

It covers your heart risk, sleep, stress, and any aches you've stopped mentioning, plus nutrition, activity, and mental wellbeing, seven areas most checkups never fully cover.

At the end, you get one score and one or two goals, not a stack of numbers to figure out on your own.

Ten minutes. Might be the one thing that connects the dots for you too.

With you,
Plum
`),

  N("minimalist", "Ultra-minimalist", "Ten questions. Ten minutes.", `
Hey there,

Your health assessment is ready.

Heart risk, sleep, stress, aches, nutrition, activity, mental wellbeing. One score for all seven.

With you,
Plum
`),
];

export function getHraNarrative(key?: string, seed?: number): HraNarrative {
  if (key) {
    const hit = HRA_NARRATIVES.find((n) => n.key === key.trim().toLowerCase());
    if (hit) return hit;
  }
  // No narrative asked for: rotate deterministically so repeated sends vary.
  const i = Math.abs(seed ?? 0) % HRA_NARRATIVES.length;
  return HRA_NARRATIVES[i];
}

export function renderHraBody(n: HraNarrative, name: string) {
  return n.body.replace(/\{\{name\}\}/g, name);
}
