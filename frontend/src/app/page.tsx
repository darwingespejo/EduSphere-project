"use client";
import Link from "@/router/link";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ChevronRight, Code2, Gauge, PenLine, Waypoints } from "lucide-react";
import { Logo, OrbitMark } from "@/components/Logo";
import { ToastHost } from "@/components/Toasts";
import { Magnetic, Marquee, ParallaxY, TiltCard } from "@/components/FX";
import { PhotoCard, WaveDivider } from "@/components/LandingArt";

const ease = [0.22, 1, 0.36, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease },
};

// Photos are quality-matched to each module's subject: code screens for the playground,
// note-taking review for peer feedback, graduation for credentials, classroom for the walkthrough.
const IMG = {
  playground: "https://images.pexels.com/photos/5473301/pexels-photo-5473301.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  playgroundCredit: "cottonbro studio / Pexels",
  review: "https://images.pexels.com/photos/5912280/pexels-photo-5912280.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  reviewCredit: "Roman Odintsov / Pexels",
  credentials: "https://images.pexels.com/photos/8093032/pexels-photo-8093032.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  credentialsCredit: "olia danilevich / Pexels",
  classroom: "https://images.pexels.com/photos/20432872/pexels-photo-20432872.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  classroomCredit: "Adam Sondel / Pexels",
};

export default function Landing() {
  return (
    <div className="relative overflow-x-clip">
      {/* nav */}
      <header className="absolute top-3 inset-x-0 z-50 px-3">
        <div className="max-w-[1160px] mx-auto px-4 md:px-7 h-[66px] flex items-center justify-between rounded-full border border-line bg-surface/85 backdrop-blur-xl shadow-[0_5px_20px_rgba(20,43,57,0.08)]">
          <Logo />
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-text">
            <a href="#features" className="hover:text-coral transition-colors">Playground</a>
            <a href="#how" className="hover:text-coral transition-colors">Your Path</a>
            <a href="#pricing" className="hover:text-coral transition-colors">Progress</a>
            <a href="#features" className="hover:text-coral transition-colors">Stories</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/verify" className="hidden sm:block font-mono text-xs text-muted hover:text-text">/verify</Link>
            <Magnetic><Link href="/register" className="btn btn-primary !py-2 !px-5">Start free</Link></Magnetic>
          </div>
        </div>
      </header>

      <section className="relative isolate min-h-[82vh] overflow-hidden bg-[#102b3c] pt-[126px] md:pt-[140px] pb-16 md:pb-20 flex items-center text-white">
        <img
          src={IMG.classroom}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(90deg, rgba(10,29,39,.94) 0%, rgba(10,29,39,.84) 43%, rgba(10,29,39,.42) 100%), linear-gradient(0deg, rgba(10,29,39,.42), transparent 55%)" }}
        />
        <div className="max-w-[1160px] w-full mx-auto px-5 md:px-8 relative">
          <div className="max-w-[700px]">
            <motion.p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm" {...fadeUp}>
              <span className="w-2 h-2 rounded-full bg-[#63d2b4] inline-block" /> Adaptive learning · placement-tested paths
            </motion.p>
            <h1 className="display font-extrabold tracking-tight mt-6 text-[clamp(48px,7vw,76px)] leading-[0.98]">
              <span className="block">Learning that</span>
              <span className="block text-[#ff8065]">moves at your</span>
              <span className="block text-[#ff8065]">own pace.</span>
            </h1>
            <motion.p className="text-white/80 text-[17px] leading-relaxed mt-7 max-w-[560px]" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
              Start with a short skills check. Get a learning path built around what you need to practice, with hands-on coding, peer feedback, and certificates you can share.
            </motion.p>
            <motion.div className="flex flex-wrap items-center gap-3 mt-9" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}>
              <Magnetic><Link href="/register" className="btn btn-primary text-[15px] !px-7 !py-3.5">Find your learning path <ArrowRight size={16} /></Link></Magnetic>
              <Magnetic strength={0.2}><Link href="/playground" className="text-[15px] font-semibold text-white hover:text-[#ffb19f] transition-colors px-2 py-3.5">Explore the playground <ArrowRight size={16} className="inline ml-1" /></Link></Magnetic>
            </motion.div>
            <motion.div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75" {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.4 }}>
              <span><strong className="text-white">10 questions</strong> to get started</span>
              <span><strong className="text-white">About 4 minutes</strong> to find your gaps</span>
              <span><strong className="text-white">Free</strong> for students</span>
            </motion.div>
          </div>
        </div>
        <div className="absolute bottom-4 right-5 z-10 hidden text-[10px] text-white/55 md:block">
          Photo: {IMG.classroomCredit}
        </div>
      </section>

      <Marquee items={["Placement", "Gap report", "Sequenced path", "Sandbox run", "Peer review", "Streaks + XP", "Certificate", "Public verify"]} />

      {/* how it works — numbers on the left, rippled-sand poster on the right */}
      <section id="how" className="max-w-[1160px] mx-auto px-5 md:px-8 py-20 md:py-28">
        <motion.div {...fadeUp}>
          <p className="eyebrow">How a path gets built</p>
          <h2 className="display font-extrabold tracking-tight text-[clamp(26px,3.6vw,40px)] mt-3 max-w-2xl">
            Measure first. Sequence second. Lock until it&apos;s done.
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-4 mt-12">
          {[
            { icon: Gauge, n: "01", t: "Placement reveals gaps", d: "8 multiple-choice and 2 written questions, each tagged to a skill. The report scores JavaScript Basics, Async, Arrays and five more from 0–100 — one number per skill, no vague grade." },
            { icon: Waypoints, n: "02", t: "The path engine re-sequences", d: "Every lesson carries a gap score: the average distance between your mastery and 100%. Highest gap goes first. Completed lessons stay fixed; everything else moves." },
            { icon: BadgeCheck, n: "03", t: "Velocity sets the aperture", d: "Your trailing 14 days of completed lessons set how many items unlock at once. Finish one, the next opens. Finish all of them and a certificate with a public verify link is issued." },
          ].map((s, i) => (
            <motion.div key={s.n} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.12 }}>
              <TiltCard className="card p-6 h-full relative" max={6}>
                <div className="flex items-center justify-between">
                  <span className="w-9 h-9 rounded-xl bg-raised grid place-items-center text-primary"><s.icon size={17} /></span>
                  <span className="font-mono text-muted text-xs">{s.n}</span>
                </div>
                <h3 className="display font-bold text-lg mt-5">{s.t}</h3>
                <p className="text-muted text-[13.5px] leading-relaxed mt-2">{s.d}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>
        <ParallaxY amount={34} className="mt-10">
          <PhotoCard src={IMG.classroom} alt="A laptop open on a desk in a classroom, ready for a lesson" credit={IMG.classroomCredit} aspect="aspect-[21/7]" />
        </ParallaxY>
      </section>

      {/* features — copy plus poster photography, alternating */}
      <section id="features" className="border-y border-line bg-surface/40">
        <div className="max-w-[1160px] mx-auto px-5 md:px-8 py-20 md:py-28 space-y-24">
          {[
            {
              icon: Code2, kicker: "Playground", title: "Code runs in a sandbox, tests argue back",
              body: "The editor is Monaco — the VS Code engine. JavaScript runs server-side in a 4-second sandbox; each test case reports pass or fail with your console output. The Two Sum exercise's hidden case is 100,000 items: the double loop passes the visible tests and times out on the hidden one, exactly the lesson it exists to teach.",
              img: IMG.playground, credit: IMG.playgroundCredit,
              aside: ["stdout / stderr / runtime ms", "per-case console capture", "HTML/CSS/JS live preview in a sandboxed iframe"],
            },
            {
              icon: PenLine, kicker: "Peer review", title: "Three classmates grade it. Nobody knows whose it is.",
              body: "Submitting an assignment automatically enqueues it for three reviews. The assigner never picks you, never repeats a reviewer, and always picks the least-loaded student first. Payloads show \"Author #2KF7N\" — no IDs, no names, either direction. Rubric sliders produce a live total; reviews worth writing take more than 20 characters.",
              img: IMG.review, credit: IMG.reviewCredit,
              aside: ["balanced-load assigner", "rubric sliders with live total", "feedback arrives as a notification"],
            },
            {
              icon: BadgeCheck, kicker: "Credentials", title: "Certificates anyone can check in one request",
              body: "Complete a path and a certificate lands in your records with a code like EDU-7Q4M-92XT. The /verify page is public — no login — and answers who holds it, which course, and when. XP feeds a square-root level curve, badges pay one-time bonuses, and the leaderboard counts only students.",
              img: IMG.credentials, credit: IMG.credentialsCredit,
              aside: ["public GET /api/v1/verify/:code", "8 earnable badges in the seed", "print-ready certificate view"],
            },
          ].map((f, i) => (
            <motion.div key={f.kicker} className={`grid md:grid-cols-2 gap-10 items-center ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`} {...fadeUp}>
              <div>
                <p className="eyebrow flex items-center gap-2"><f.icon size={14} /> {f.kicker}</p>
                <h3 className="display font-extrabold tracking-tight text-[clamp(22px,3vw,32px)] mt-3">{f.title}</h3>
                <p className="text-muted leading-relaxed mt-4 max-w-[480px]">{f.body}</p>
                <div className="card p-5 mt-6 space-y-2.5 max-w-[480px]">
                  {f.aside.map((a) => (
                    <div key={a} className="flex items-center gap-3 text-sm">
                      <ChevronRight size={14} className="text-mint shrink-0" />
                      <span className="text-muted">{a}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ParallaxY amount={i % 2 ? 40 : 26}>
                <TiltCard max={7}>
                  <PhotoCard src={f.img} alt={`${f.kicker} — module illustration`} credit={f.credit} aspect="aspect-[4/3]" />
                </TiltCard>
              </ParallaxY>
            </motion.div>
          ))}
        </div>
      </section>

      <WaveDivider />

      {/* pricing */}
      <section id="pricing" className="max-w-[1160px] mx-auto px-5 md:px-8 py-20 md:py-28">
        <motion.div {...fadeUp} className="text-center">
          <p className="eyebrow">Pricing</p>
          <h2 className="display font-extrabold tracking-tight text-[clamp(26px,3.6vw,40px)] mt-3">Free while you place. Pro when you compete.</h2>
          <p className="text-muted mt-3 max-w-xl mx-auto text-[15px]">Pay securely through PayMongo with GCash, Maya, or card. Paid plans are one-time purchases for 30 days and do not auto-renew.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-4 mt-12">
          {[
            { name: "Free", price: "$0", per: "forever", items: ["Placement + adaptive path", "Playground with visible tests", "Public leaderboard"], cta: "Create account", href: "/register", primary: false },
            { name: "Pro", price: "₱699", per: "per 30 days", items: ["Everything in Free", "Hidden tests revealed after pass", "Certificate codes for every course", "Priority peer-review matching"], cta: "Try Pro checkout", href: "/billing", primary: true },
            { name: "Team", price: "₱469", per: "per seat · 30 days · 3-seat minimum", items: ["Everything in Pro", "Instructor dashboards", "Cohort leaderboards", "Live session scheduling"], cta: "Try Team checkout", href: "/billing", primary: false },
          ].map((p, i) => (
            <motion.div key={p.name} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
              <TiltCard max={5} className={`card p-7 flex flex-col h-full ${p.primary ? "border-primary/50 !bg-raised relative overflow-hidden" : ""}`}>
                {p.primary && <div className="absolute top-0 right-0 font-mono text-[10px] bg-primary text-primary-ink px-3 py-1 rounded-bl-xl">popular</div>}
                <p className="eyebrow">{p.name}</p>
                <p className="mt-3"><span className="display text-4xl font-extrabold">{p.price}</span> <span className="text-muted text-sm">{p.per}</span></p>
                <ul className="space-y-2.5 mt-6 flex-1">
                  {p.items.map((it) => (
                    <li key={it} className="flex gap-2.5 text-sm text-muted"><ChevronRight size={14} className="text-mint shrink-0 mt-0.5" />{it}</li>
                  ))}
                </ul>
                <Magnetic strength={0.15} className="mt-7 w-full">
                  <Link href={p.href} className={`btn w-full ${p.primary ? "btn-primary" : "btn-ghost"}`}>{p.cta}</Link>
                </Magnetic>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* demo access */}
      <section className="max-w-[1160px] mx-auto px-5 md:px-8 pb-24">
        <motion.div className="card-raise p-7 md:p-9 grid md:grid-cols-[1fr_auto] gap-6 items-center" {...fadeUp}>
          <div>
            <p className="eyebrow">Demo access — seeded placeholder data</p>
            <h3 className="display font-bold text-xl mt-2">Three accounts, one password: <span className="font-mono text-mint">password123</span></h3>
            <div className="font-mono text-[12.5px] text-muted mt-3 space-y-1">
              <p>aria@edusphere.dev — student, mid-path, queue waiting</p>
              <p>instructor@edusphere.dev — class analytics and grading</p>
              <p>admin@edusphere.dev — user management</p>
            </div>
          </div>
          <Magnetic><Link href="/login" className="btn btn-mint !px-6 !py-3.5 justify-self-start md:justify-self-end">Open the demo <ArrowRight size={15} /></Link></Magnetic>
        </motion.div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1160px] mx-auto px-5 md:px-8 py-8 flex flex-wrap items-center justify-between gap-4">
          <OrbitMark size={22} />
          <p className="text-muted text-xs font-mono">EduSphere demo build. Seed data is fictional; payments are processed by PayMongo.</p>
          <div className="flex gap-5 text-xs text-muted">
            <Link href="/verify" className="hover:text-text">Verify</Link>
            <Link href="/login" className="hover:text-text">Sign in</Link>
            <Link href="/register" className="hover:text-text">Register</Link>
          </div>
        </div>
      </footer>
      <ToastHost />
    </div>
  );
}
