// Integrity Reforestation — Carousel Template Library
// 10 branded slide templates for Instagram carousel content

import type { Slide, SlideStyle, SlideContent, SlideType, CarouselMeta } from "./types";
import { DEFAULT_STYLE } from "./types";

// ── Template interface ────────────────────────────────────────────────────────

export interface CarouselTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "impact" | "education" | "process" | "story" | "cta";
  tagline: string;
  slides: Slide[];
  defaultMeta?: Partial<CarouselMeta>;
}

// ── Integrity brand base style ────────────────────────────────────────────────
// Dark forest bg · forestry green (#1C7C54) · gold (#E0B84C) · white text
// Heading font: Montserrat ExtraBold · Body: Inter · Large numbers: Anton

const IR: SlideStyle = {
  ...DEFAULT_STYLE,
  bgColor: "#0d1a0f",
  bgImage: null,
  bgOverlayOpacity: 65,
  headlineColor: "#ffffff",
  subheadlineColor: "#E0B84C",
  bodyColor: "rgba(255,255,255,0.82)",
  subtextColor: "rgba(255,255,255,0.45)",
  ctaColor: "#ffffff",
  ctaBgColor: "#1C7C54",
  accentColor: "#1C7C54",
  fontFamily: "'Montserrat', sans-serif",
  headlineWeight: "900",
  textAlign: "left",
  lineSpacing: 1.45,
  paddingX: 44,
  paddingY: 52,
  showLogo: true,
  showHandle: true,
  showAccent: true,
  accentStyle: "line",
  layout: "centered",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sc(
  headline: string,
  subheadline = "",
  body = "",
  subtext = "",
  ctaText = ""
): SlideContent {
  return { headline, subheadline, body, subtext, ctaText };
}

let _tplCounter = 0;

function ts(type: SlideType, content: SlideContent, style: Partial<SlideStyle> = {}): Slide {
  _tplCounter++;
  return {
    id: `tpl-${type}-${_tplCounter}`,
    type,
    content,
    style: { ...IR, ...style },
    image: null,
  };
}

// ── Groundwork Collection base styles (matched to brand reference slides) ────
// Three visual treatments: Editorial Light · Field Documentary · Canopy Atmosphere
// All share: bottom-heavy layout · outline CTA pill · Noto Sans 900 · no accent line

// "Apparel with Impact" → headline slot (small, weight 400, renders first = above)
// "The\nGroundwork\nCollection" → subheadline slot (96px, weight 900, renders second = main)
// CTA right-aligned independently of text
const GW_COMMON: Partial<SlideStyle> = {
  headlineFontSize: 20,       // "Apparel with Impact" eyebrow
  headlineWeight: "400",      // regular weight for eyebrow
  subheadlineFontSize: 96,    // "The Groundwork Collection" — fills ~35% of slide height
  subheadlineWeight: "900",   // black/extra-bold to match reference
  ctaFontSize: 12,
  ctaAlign: "right",          // CTA pill sits at right edge, independent of left text
  fontFamily: "'Noto Sans', sans-serif",
  textAlign: "left",
  lineSpacing: 1.15,
  paddingX: 44,
  paddingY: 52,
  showLogo: true,
  showHandle: false,
  showAccent: false,
  accentStyle: "none",
  layout: "bottom-heavy",
  bgOverlayOpacity: 0,
};

// 1. Groundwork Editorial — warm linen, dark green text, outline teal CTA
const GW_ED: SlideStyle = {
  ...DEFAULT_STYLE,
  ...GW_COMMON,
  bgColor:           "#ECE7DE",
  headlineColor:     "#0B2820",
  subheadlineColor:  "rgba(11,40,32,0.60)",
  bodyColor:         "#2A3830",
  subtextColor:      "rgba(11,40,32,0.45)",
  ctaColor:          "#1CC4AC",
  ctaBgColor:        "#ECE7DE", // matches bg → outline pill
  accentColor:       "#1CC4AC",
};

// 2. Field Documentary — dark near-black, photo overlay, white text, outline teal CTA
const GW_FD: SlideStyle = {
  ...DEFAULT_STYLE,
  ...GW_COMMON,
  bgColor:           "#141C16",
  bgOverlayOpacity:  72,
  headlineColor:     "#FFFFFF",
  subheadlineColor:  "rgba(255,255,255,0.65)",
  bodyColor:         "#D8D8D4",
  subtextColor:      "rgba(255,255,255,0.45)",
  ctaColor:          "#1CC4AC",
  ctaBgColor:        "#141C16", // matches bg → outline pill
  accentColor:       "#1CC4AC",
};

// 3. Canopy Atmosphere — deep forest, cool-tinted white body, outline teal CTA
const GW_CA: SlideStyle = {
  ...DEFAULT_STYLE,
  ...GW_COMMON,
  bgColor:           "#1A2820",
  bgOverlayOpacity:  60,
  headlineColor:     "#FFFFFF",
  subheadlineColor:  "rgba(255,255,255,0.65)",
  bodyColor:         "#C8D8D0",
  subtextColor:      "rgba(255,255,255,0.40)",
  ctaColor:          "#1CC4AC",
  ctaBgColor:        "#1A2820", // matches bg → outline pill
  accentColor:       "#1CC4AC",
};

function gw(style: SlideStyle, type: SlideType, content: SlideContent, overrides: Partial<SlideStyle> = {}): Slide {
  _tplCounter++;
  return { id: `gw-${type}-${_tplCounter}`, type, content, style: { ...style, ...overrides }, image: null };
}

// ── 10 Integrity Templates ────────────────────────────────────────────────────

export const INTEGRITY_TEMPLATES: CarouselTemplate[] = [

  // ────────────────────────────────────────────────────────────────────────────
  // 1. IMPACT STAT
  // Large numbers that stop the scroll and demand a response
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "impact-stat",
    name: "Impact Stat",
    description: "Lead with a staggering number to stop the scroll and drive urgency",
    icon: "📊",
    category: "impact",
    tagline: "Numbers that demand action",
    defaultMeta: {
      topic: "Wildfire impact statistics",
      audience: "Environmentally conscious Canadians",
      cta: "Support reforestation",
    },
    slides: [
      ts("hook",
        sc("One Number\nThat Changes\nEverything", "", "", "Swipe to see the data →", ""),
        { headlineFontSize: 46, headlineColor: "#E0B84C", layout: "hero-hook", textAlign: "center", accentStyle: "none" }
      ),
      ts("proof",
        sc("2.7 Million", "Hectares burned in Canada — 2023", "An area larger than New Brunswick, lost in a single wildfire season.", "Source: Canadian Forest Service", ""),
        { headlineFontSize: 68, fontFamily: "'Anton', cursive", headlineColor: "#E0B84C", subheadlineColor: "#ffffff", layout: "centered", textAlign: "center", accentStyle: "dot" }
      ),
      ts("proof",
        sc("3,000+", "Species lose habitat every wildfire season", "Boreal caribou. Wolverine. Woodland ptarmigan.\nTheir forests are disappearing.", "", ""),
        { headlineFontSize: 68, fontFamily: "'Anton', cursive", headlineColor: "#ffffff", subheadlineColor: "#1C7C54", layout: "centered", textAlign: "center", accentStyle: "dot" }
      ),
      ts("proof",
        sc("18.5M", "Hectares burned in 2023 — a record", "10× the annual historical average.\nThe trend is only accelerating.", "Source: NFDB 2023 Annual Report", ""),
        { headlineFontSize: 68, fontFamily: "'Anton', cursive", headlineColor: "#ff6b35", subheadlineColor: "rgba(255,255,255,0.7)", layout: "centered", textAlign: "center", accentStyle: "dot" }
      ),
      ts("insight",
        sc("1 Planter.\n10,000 Trees.", "", "That's what a single Integrity planter can deliver in one season.\nNumbers like these are the only answer.", "", ""),
        { headlineFontSize: 44, headlineColor: "#E0B84C", layout: "hero-hook", textAlign: "center" }
      ),
      ts("cta",
        sc("Help Us\nReforest Canada", "", "Every dollar plants trees in the ground — not in a boardroom.", "", "Join the Mission"),
        { headlineFontSize: 38, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 2. WILDFIRE BEFORE / AFTER
  // Contrast a living forest with post-fire devastation to show the stakes
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "wildfire-before-after",
    name: "Wildfire Before/After",
    description: "Contrast living forest with post-fire devastation to reveal the full stakes",
    icon: "🔥",
    category: "impact",
    tagline: "The cost of inaction",
    defaultMeta: {
      topic: "Wildfire impact and forest recovery",
      audience: "Nature advocates, donors",
      cta: "Fund reforestation now",
    },
    slides: [
      ts("hook",
        sc("This Is What\nCanada Looks Like\nAfter Wildfire", "", "", "Swipe to see the full picture →", ""),
        { headlineFontSize: 40, layout: "hero-hook", textAlign: "center" }
      ),
      ts("story",
        sc("Before:\nA Living Forest", "", "Dense canopy. Mixed species. Clean air. A carbon sink absorbing millions of tonnes of CO₂ every year.", "The boreal — the world's largest terrestrial biome", ""),
        { headlineFontSize: 32, headlineColor: "#39de8b", layout: "top-heavy", accentStyle: "bar", accentColor: "#39de8b" }
      ),
      ts("comparison",
        sc("After:\nThe Burn Zone", "", "Charred stumps. Silent forest floors.\nAshen soil. A carbon sink turned carbon source.", "Recovery without intervention: 80–200 years", ""),
        { headlineFontSize: 32, headlineColor: "#ff6b35", layout: "top-heavy", accentStyle: "bar", accentColor: "#ff6b35" }
      ),
      ts("pain",
        sc("Recovery Takes\nCenturies Without\nIntervention", "", "Severe burns destroy the soil seed bank. Without active reforestation, natural recovery alone can take 200+ years.", "", ""),
        { headlineFontSize: 32, layout: "centered" }
      ),
      ts("insight",
        sc("Unless We Act", "", "Reforestation accelerates recovery from centuries to decades.\nNative species. Precision planting. Real data.", "The science is clear — intervention works", ""),
        { headlineFontSize: 38, headlineColor: "#E0B84C", layout: "centered" }
      ),
      ts("cta",
        sc("Rebuild\nthe Forest", "", "Don't wait for nature to do what we can do now.", "", "Support Reforestation"),
        { headlineFontSize: 46, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 3. FOREST FACT
  // Educate with surprising science about forests, fire, and reforestation
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "forest-fact",
    name: "Forest Fact",
    description: "Educate with surprising facts about forests, fire, and reforestation science",
    icon: "🌲",
    category: "education",
    tagline: "Science that changes perspective",
    defaultMeta: {
      topic: "Forest ecology and conservation",
      audience: "Curious Canadians, students, environmentalists",
      cta: "Follow for more forest science",
    },
    slides: [
      ts("hook",
        sc("5 Forest Facts\nThat Will Change\nHow You See Trees", "", "", "Save this. Share it. →", ""),
        { headlineFontSize: 40, layout: "hero-hook", textAlign: "center" }
      ),
      ts("insight",
        sc("Trees Talk", "Forest Fact #1", "Forests communicate through underground fungal networks — the \"Wood Wide Web.\" They share nutrients with sick and weakened neighbours.", "01 / 05", ""),
        { headlineFontSize: 36, headlineColor: "#E0B84C", layout: "top-heavy", accentStyle: "bar", accentColor: "#E0B84C" }
      ),
      ts("insight",
        sc("1 Tree =\n100 Years of\nCarbon Work", "Forest Fact #2", "A single mature tree absorbs ~22kg of CO₂ per year. Over a century, that's more than 2 tonnes of carbon locked away.", "02 / 05", ""),
        { headlineFontSize: 30, headlineColor: "#39de8b", layout: "top-heavy", accentStyle: "bar", accentColor: "#39de8b" }
      ),
      ts("insight",
        sc("Old Growth\nStores 3× More\nCarbon", "Forest Fact #3", "Old-growth forests are carbon powerhouses. Young plantations can't match their density or soil depth for decades.", "03 / 05", ""),
        { headlineFontSize: 30, headlineColor: "#E0B84C", layout: "top-heavy", accentStyle: "bar", accentColor: "#E0B84C" }
      ),
      ts("insight",
        sc("Wildfire Is Natural.\nThis Rate Isn't.", "Forest Fact #4", "Fire has always been part of the boreal cycle. But climate change has made fires 3× more frequent and 5× more intense.", "04 / 05", ""),
        { headlineFontSize: 28, headlineColor: "#ff6b35", layout: "top-heavy", accentStyle: "bar", accentColor: "#ff6b35" }
      ),
      ts("insight",
        sc("Reforestation\nWorks", "Forest Fact #5", "Strategically planted native species can restore an ecosystem 10× faster than natural regrowth alone.", "05 / 05", ""),
        { headlineFontSize: 36, headlineColor: "#39de8b", layout: "top-heavy", accentStyle: "bar", accentColor: "#39de8b" }
      ),
      ts("cta",
        sc("Plant a Tree Today", "", "Integrity Reforestation plants native species in fire-affected zones across Canada.", "", "Learn More"),
        { headlineFontSize: 42, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 4. REFORESTATION PROCESS
  // Step-by-step walkthrough of Integrity's science-based planting method
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "reforestation-process",
    name: "Reforestation Process",
    description: "Walk through Integrity's science-based 5-step planting process",
    icon: "🌱",
    category: "process",
    tagline: "From ash to ecosystem",
    defaultMeta: {
      topic: "Reforestation methodology",
      audience: "Donors, potential volunteers, environmental professionals",
      cta: "Fund a planting season",
    },
    slides: [
      ts("hook",
        sc("How We Bring\na Forest Back\nfrom the Ashes", "", "", "Our 5-step process →", ""),
        { headlineFontSize: 42, layout: "hero-hook", textAlign: "center" }
      ),
      ts("steps",
        sc("Step 1:\nSite Assessment", "", "Before a single seedling goes in the ground, we map burn severity, soil composition, drainage, and native species data for every hectare.", "Science before shovels", ""),
        { headlineFontSize: 30, headlineColor: "#E0B84C", layout: "framework-layout", accentColor: "#E0B84C" }
      ),
      ts("steps",
        sc("Step 2:\nSeedling Selection", "", "We source native, climate-adapted species — matched to each specific microhabitat. No monocultures. Maximum biodiversity from day one.", "The right tree in the right place", ""),
        { headlineFontSize: 30, headlineColor: "#E0B84C", layout: "framework-layout", accentColor: "#E0B84C" }
      ),
      ts("steps",
        sc("Step 3:\nPrecision Planting", "", "Skilled planters work systematically across challenging terrain — 1,500 to 2,000 seedlings per planter, per day. Every tree GPS-logged.", "Every tree GPS-logged at planting", ""),
        { headlineFontSize: 30, headlineColor: "#E0B84C", layout: "framework-layout", accentColor: "#E0B84C" }
      ),
      ts("steps",
        sc("Step 4:\nMonitoring & Data", "", "Annual survival checks. GPS-tracked plots. Soil carbon measurements. We know exactly what's happening in every hectare we've ever planted.", "Real accountability. Real results.", ""),
        { headlineFontSize: 30, headlineColor: "#E0B84C", layout: "framework-layout", accentColor: "#E0B84C" }
      ),
      ts("insight",
        sc("Step 5:\nThe Forest Returns", "", "In 10–15 years, a thriving mixed-species forest emerges. Carbon locked in. Biodiversity restored. Wildlife home.", "This is what your support makes possible", ""),
        { headlineFontSize: 30, headlineColor: "#39de8b", layout: "framework-layout", accentColor: "#39de8b" }
      ),
      ts("cta",
        sc("Fund a\nPlanting Season", "", "One season. Thousands of trees. A legacy that outlives us all.", "", "Get Involved"),
        { headlineFontSize: 42, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 5. MYTH VS REALITY
  // Debunk the most common wildfire and reforestation misconceptions
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "myth-vs-reality",
    name: "Myth vs Reality",
    description: "Debunk the most common wildfire and reforestation misconceptions with science",
    icon: "⚖️",
    category: "education",
    tagline: "Set the record straight",
    defaultMeta: {
      topic: "Wildfire and reforestation myths",
      audience: "Skeptics, general public, policymakers",
      cta: "Read the full science",
    },
    slides: [
      ts("hook",
        sc("3 Wildfire Myths\nDebunked by\nForest Scientists", "", "", "Truth incoming →", ""),
        { headlineFontSize: 40, layout: "hero-hook", textAlign: "center" }
      ),
      ts("comparison",
        sc("Myth #1:\nWildfires Are\nAlways Natural", "", "❌ \"Fire is natural — we shouldn't intervene\"\n\n✅ Climate change has tripled fire frequency. This is no longer a natural cycle. It's a crisis.", "", ""),
        { headlineFontSize: 24, layout: "comparison-layout", textAlign: "left", accentStyle: "bar" }
      ),
      ts("comparison",
        sc("Myth #2:\nForests Recover\nOn Their Own", "", "❌ \"Nature will bounce back without help\"\n\n✅ Severe burns destroy soil seed banks. Without planting, recovery can take 200+ years. We don't have that time.", "", ""),
        { headlineFontSize: 24, layout: "comparison-layout", textAlign: "left", accentStyle: "bar" }
      ),
      ts("comparison",
        sc("Myth #3:\nTree Planting\nDoesn't Work", "", "❌ \"Monoculture plantations do more harm than good\"\n\n✅ Native mixed-species planting restores biodiversity and accelerates carbon sequestration by decades.", "", ""),
        { headlineFontSize: 24, layout: "comparison-layout", textAlign: "left", accentStyle: "bar" }
      ),
      ts("insight",
        sc("The Science Is\nUnambiguous", "", "Strategic reforestation with native species is one of the most proven, cost-effective climate solutions available today.", "Source: IPCC Sixth Assessment Report, 2022", ""),
        { headlineFontSize: 34, headlineColor: "#E0B84C", layout: "centered" }
      ),
      ts("cta",
        sc("Follow the Science.\nFund the Solution.", "", "", "", "Explore the Research"),
        { headlineFontSize: 34, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 6. WILDFIRE MAP INTELLIGENCE
  // Data-driven breakdown of Canada's wildfire geography and acceleration
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "wildfire-map-intelligence",
    name: "Wildfire Map Intelligence",
    description: "Data-driven breakdown of Canada's wildfire geography and accelerating patterns",
    icon: "🗺️",
    category: "impact",
    tagline: "The geography of the crisis",
    defaultMeta: {
      topic: "Canadian wildfire data and geography",
      audience: "Data-driven readers, environmental professionals",
      cta: "View our wildfire intelligence map",
    },
    slides: [
      ts("hook",
        sc("Canada's Wildfire\nCrisis:\nMapped", "", "", "The data tells the story →", ""),
        { headlineFontSize: 46, layout: "hero-hook", textAlign: "center" }
      ),
      ts("proof",
        sc("55%", "of Canada is boreal forest", "The boreal biome is the world's largest land-based carbon store — and it's burning at an unprecedented rate.", "Source: Natural Resources Canada", ""),
        { headlineFontSize: 80, fontFamily: "'Anton', cursive", headlineColor: "#E0B84C", subheadlineColor: "#ffffff", layout: "centered", textAlign: "center", accentStyle: "dot" }
      ),
      ts("proof",
        sc("2023:\nRecord Season", "", "18.5 million hectares burned — 10× the annual historical average.\nSmoke reached every major Canadian city.", "NFDB Annual Statistics 2023", ""),
        { headlineFontSize: 38, headlineColor: "#ff6b35", layout: "top-heavy", accentStyle: "bar", accentColor: "#ff6b35" }
      ),
      ts("insight",
        sc("The High-Risk Zones", "", "British Columbia · Alberta · Saskatchewan\nOntario · Quebec · Northwest Territories\n\nAll provinces face escalating wildfire risk.", "Hot zones expand every decade", ""),
        { headlineFontSize: 30, layout: "bullet-breakdown", accentStyle: "line" }
      ),
      ts("insight",
        sc("Burn Area Has\nDoubled Every\nDecade Since 1970", "", "This isn't variability. It's a trajectory. Without intervention, climate models project fire activity 3–5× current levels by 2100.", "Source: CWFIS, Environment & Climate Change Canada", ""),
        { headlineFontSize: 30, headlineColor: "#ff6b35", layout: "centered" }
      ),
      ts("cta",
        sc("Track Canada's\nWildfires", "", "Our Wildfire Intelligence Map shows real data on active fires, burn scars, and restoration zones.", "", "View the Map"),
        { headlineFontSize: 36, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 7. PLANTER PERSPECTIVE
  // A field-level human story from the people doing the actual reforestation work
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "planter-perspective",
    name: "Planter Perspective",
    description: "A raw, field-level human story from the people doing the actual reforestation work",
    icon: "👤",
    category: "story",
    tagline: "The humans rebuilding Canada",
    defaultMeta: {
      topic: "Tree planting life and culture",
      audience: "People who respond to authentic human stories",
      cta: "Support our planters",
    },
    slides: [
      ts("hook",
        sc("I Plant 1,500\nTrees Before Lunch.\nHere's Why.", "", "", "A planter's story →", ""),
        { headlineFontSize: 36, layout: "hero-hook", textAlign: "center" }
      ),
      ts("quote",
        sc("\"Every seedling I push\ninto the ground is a\npromise to a forest\nthat doesn't exist yet.\"", "", "", "— Morgan, Field Planter · 8th Season", ""),
        { headlineFontSize: 22, headlineColor: "#E0B84C", headlineWeight: "700", layout: "quote-layout", textAlign: "center" }
      ),
      ts("story",
        sc("5am.\nScorched earth.", "", "The terrain is uneven. The bags are heavy. The work is relentless. Burned stumps as far as you can see.\n\nAnd that's before the mosquitoes.", "", ""),
        { headlineFontSize: 32, headlineColor: "#ffffff", layout: "story-layout" }
      ),
      ts("story",
        sc("Then — 10 years\nlater.", "", "I drove back to a site I planted as a rookie. The trees were over my head. Birdsong everywhere. Deer tracks in the mud.\n\nI cried in my truck.", "", ""),
        { headlineFontSize: 28, headlineColor: "#39de8b", layout: "story-layout" }
      ),
      ts("insight",
        sc("That's the Work", "", "Unglamorous. Physically brutal. Ecologically essential.\n\nThe kind of work that outlives you. That heals land that was broken by forces bigger than any of us.", "This is what integrity looks like.", ""),
        { headlineFontSize: 34, headlineColor: "#E0B84C", layout: "centered" }
      ),
      ts("cta",
        sc("Support Our\nPlanters", "", "Skilled, passionate, and dedicated to Canada's forests. Help fund their next season.", "", "Join the Mission"),
        { headlineFontSize: 40, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 8. ENVIRONMENTAL PROBLEM
  // Lay out the full scale of the ecological crisis before revealing the solution
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "environmental-problem",
    name: "Environmental Problem",
    description: "Lay out the full scale of the ecological crisis then reveal the solution",
    icon: "⚠️",
    category: "impact",
    tagline: "Name the problem. Build the urgency.",
    defaultMeta: {
      topic: "Forest carbon and climate feedback loops",
      audience: "Climate-conscious audience, policymakers",
      cta: "Help break the cycle",
    },
    slides: [
      ts("hook",
        sc("Canada Is Losing\nIts Lungs.\nHere's the Data.", "", "", "The carbon crisis explained →", ""),
        { headlineFontSize: 40, layout: "hero-hook", textAlign: "center" }
      ),
      ts("problem",
        sc("The Scale", "", "Every year, Canadian wildfires release more carbon into the atmosphere than all of Canada's vehicles and industry combined.\n\nThat's not a forecast. That's today.", "", ""),
        { headlineFontSize: 32, headlineColor: "#ff6b35", layout: "top-heavy", accentStyle: "bar", accentColor: "#ff6b35" }
      ),
      ts("problem",
        sc("The Carbon Flip", "", "Healthy forests are carbon sinks — they absorb CO₂. Burned forests become carbon sources. They release decades of stored carbon in hours.", "", ""),
        { headlineFontSize: 28, layout: "top-heavy", accentStyle: "bar" }
      ),
      ts("pain",
        sc("We're in a\nFeedback Loop", "", "More warming → more fire → more CO₂ → more warming.\n\nThe loop tightens with every degree. And it's already running.", "", ""),
        { headlineFontSize: 32, headlineColor: "#ff6b35", layout: "centered" }
      ),
      ts("insight",
        sc("Breaking\nthe Cycle", "", "Reforestation is one of the most direct levers we have:\n\n• Sequesters carbon at scale\n• Rebuilds biodiversity corridors\n• Stabilizes soil and watersheds", "The intervention that changes the math", ""),
        { headlineFontSize: 30, headlineColor: "#39de8b", layout: "bullet-breakdown", accentColor: "#39de8b" }
      ),
      ts("cta",
        sc("Help Break\nthe Cycle", "", "Every tree planted is a vote against the feedback loop.", "", "Plant Trees Now"),
        { headlineFontSize: 44, layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 9. FUTURE FOREST VISION
  // An inspiring picture of what Canada's forests could look like if we act
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "future-forest-vision",
    name: "Future Forest Vision",
    description: "Paint an inspiring picture of what Canada's forests could look like if we act",
    icon: "✨",
    category: "story",
    tagline: "The future worth fighting for",
    defaultMeta: {
      topic: "Reforestation vision and long-term goals",
      audience: "Optimistic action-takers, legacy donors",
      cta: "Plant your legacy",
    },
    slides: [
      ts("hook",
        sc("Imagine Canada\nIn 100 Years.\nIf We Act Now.", "", "", "The future we're building →", ""),
        { headlineFontSize: 40, headlineColor: "#E0B84C", layout: "hero-hook", textAlign: "center" }
      ),
      ts("insight",
        sc("50 Million\nTrees", "", "Our 30-year mission. Enough to sequester over 1 million tonnes of CO₂ annually — and restore hundreds of thousands of hectares of Canadian habitat.", "", ""),
        { headlineFontSize: 64, fontFamily: "'Anton', cursive", headlineColor: "#39de8b", layout: "centered", textAlign: "center", accentStyle: "dot" }
      ),
      ts("story",
        sc("Full Ecosystem\nRestoration", "", "Not just trees — wolves, elk, salmon, songbirds, and pollinators returning to restored boreal habitat. A web of life, rebuilt from the ground up.", "", ""),
        { headlineFontSize: 30, headlineColor: "#E0B84C", layout: "centered" }
      ),
      ts("insight",
        sc("It Starts With\na Seedling", "", "Every tree planted today is a structural vote for the future. The forest we plant now is the forest our grandchildren will walk through.", "", ""),
        { headlineFontSize: 32, layout: "centered" }
      ),
      ts("proof",
        sc("The Math", "", "$20 → 20 native trees planted\n$100 → one micro-habitat restored\n$500 → a full planting day funded\n\nYour impact is measurable. Permanent.", "", ""),
        { headlineFontSize: 28, headlineColor: "#E0B84C", layout: "bullet-breakdown", textAlign: "left" }
      ),
      ts("cta",
        sc("Plant Your\nLegacy", "", "The best time to plant a tree was 20 years ago.\nThe second best time is today.", "", "Start Today →"),
        { headlineFontSize: 44, headlineColor: "#E0B84C", layout: "centered", textAlign: "center" }
      ),
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // 10. CALL TO ACTION
  // A high-conversion sequence moving followers from awareness to action
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "call-to-action",
    name: "Call To Action",
    description: "A high-conversion sequence that moves followers from awareness to decisive action",
    icon: "👉",
    category: "cta",
    tagline: "Turn attention into action",
    defaultMeta: {
      topic: "Donation and volunteering",
      audience: "Warm audience, engaged followers",
      cta: "Plant trees now",
    },
    slides: [
      ts("hook",
        sc("You Have More\nPower Than\nYou Think", "", "", "Here's how to use it →", ""),
        { headlineFontSize: 44, headlineColor: "#E0B84C", layout: "hero-hook", textAlign: "center" }
      ),
      ts("proof",
        sc("The Numbers\nAre Simple", "", "$20 plants 20 trees\n$100 restores a micro-habitat\n$500 funds a full planting day\n$5,000 names a forest in your honour", "100% of funds go directly to reforestation", ""),
        { headlineFontSize: 28, headlineColor: "#39de8b", layout: "bullet-breakdown", textAlign: "left" }
      ),
      ts("steps",
        sc("Three Ways\nto Act Today", "", "1. Donate — every dollar plants trees in the ground\n2. Share — reach matters as much as money\n3. Volunteer — show up in person this season", "", ""),
        { headlineFontSize: 28, headlineColor: "#E0B84C", layout: "bullet-breakdown", textAlign: "left" }
      ),
      ts("proof",
        sc("Your Impact\nIs Tracked", "", "GPS-logged planting records. Annual survival updates. Real photos from your trees in the ground.\n\nThis isn't a donation into the void.", "", ""),
        { headlineFontSize: 28, layout: "centered" }
      ),
      ts("proof",
        sc("10,000+\nSupporters", "", "Students. CEOs. Families. First Nations communities.\nEvery background. One mission.", "Join the people already planting the future", ""),
        { headlineFontSize: 60, fontFamily: "'Anton', cursive", headlineColor: "#E0B84C", layout: "centered", textAlign: "center", accentStyle: "dot" }
      ),
      ts("cta",
        sc("Take Action\nToday", "", "Every click, share, and dollar moves the needle.\nThe forest doesn't wait.", "", "Plant Now →"),
        { headlineFontSize: 44, layout: "centered", textAlign: "center", accentStyle: "none" }
      ),
    ],
  },

  // ── Integrity Pre-set 1: Groundwork Editorial ─────────────────────────────
  // Clean linen background · dark forest green type · teal outline CTA pill
  {
    id: "groundwork-editorial",
    name: "Groundwork Editorial",
    description: "Clean editorial look — warm linen background with dark forest green type and teal outline CTA",
    icon: "◻",
    category: "cta",
    tagline: "Premium brand, minimal distraction",
    defaultMeta: { topic: "Groundwork Collection apparel", audience: "Environmentally conscious shoppers", cta: "Learn more" },
    slides: [
      gw(GW_ED, "hook",
        sc("Apparel with Impact", "The\nGroundwork\nCollection", "", "", "LEARN MORE  ›"),
      ),
      gw(GW_ED, "proof",
        sc("Purpose-Driven Design", "Built for\nthe Field.", "Every piece is made to move — in the bush, on-site, or out in your community.\nMaterials that earn their place.", "", ""),
      ),
      gw(GW_ED, "insight",
        sc("Apparel with Impact", "Every Purchase\nPlants Trees.", "A portion of every sale goes directly to boots-on-the-ground reforestation work.\nThis is what it means to wear your values.", "", ""),
      ),
      gw(GW_ED, "cta",
        sc("Apparel with Impact", "The\nGroundwork\nCollection", "", "", "LEARN MORE  ›"),
      ),
    ],
  },

  // ── Integrity Pre-set 2: Field Documentary ────────────────────────────────
  // Dark near-black · photo background with heavy overlay · white type · teal outline CTA
  {
    id: "groundwork-field-documentary",
    name: "Field Documentary",
    description: "Full-bleed photo with heavy dark overlay — white text, desaturated field aesthetic, teal outline CTA",
    icon: "▣",
    category: "story",
    tagline: "Bring the field to the feed",
    defaultMeta: { topic: "Groundwork Collection in action", audience: "Environmentally conscious Canadians", cta: "Learn more" },
    slides: [
      gw(GW_FD, "hook",
        sc("Apparel with Impact", "The\nGroundwork\nCollection", "", "", "LEARN MORE  ›"),
      ),
      gw(GW_FD, "proof",
        sc("Built to Last", "Worn in\nthe Field.", "Our planters wear it every season.\nDesigned for the work — not the aesthetic.\n(Though it does both.)", "", ""),
      ),
      gw(GW_FD, "insight",
        sc("Apparel with Impact", "Apparel That\nGives Back.", "Every purchase funds reforestation projects across Canada.\nReal trees. Real impact. Real receipts.", "", ""),
      ),
      gw(GW_FD, "cta",
        sc("Apparel with Impact", "The\nGroundwork\nCollection", "", "", "LEARN MORE  ›"),
      ),
    ],
  },

  // ── Integrity Pre-set 3: Canopy Atmosphere ────────────────────────────────
  // Deep forest green · atmospheric photo overlay · cool-tinted white body · teal outline CTA
  {
    id: "groundwork-canopy-atmosphere",
    name: "Canopy Atmosphere",
    description: "Atmospheric forest mood — deep green dark tones, cool-tinted body text, teal outline CTA",
    icon: "◈",
    category: "story",
    tagline: "Forest depth, brand warmth",
    defaultMeta: { topic: "Groundwork Collection lifestyle", audience: "Outdoor community and forest advocates", cta: "Learn more" },
    slides: [
      gw(GW_CA, "hook",
        sc("Apparel with Impact", "The\nGroundwork\nCollection", "", "", "LEARN MORE  ›"),
      ),
      gw(GW_CA, "proof",
        sc("Made for Those Who Show Up", "From the\nCanopy Down.", "Designed for the people who are actually out there —\nplanting, protecting, and growing the next generation of forests.", "", ""),
      ),
      gw(GW_CA, "insight",
        sc("Apparel with Impact", "Wear the\nMission.", "Every stitch is connected to real reforestation work.\nThis collection is your proof of participation.", "", ""),
      ),
      gw(GW_CA, "cta",
        sc("Apparel with Impact", "The\nGroundwork\nCollection", "", "", "LEARN MORE  ›"),
      ),
    ],
  },
];
