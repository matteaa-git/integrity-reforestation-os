// Carousel Builder — shared types, constants, templates, seed data

// ── Slide types ──

export type SlideType =
  | "hook"
  | "problem"
  | "pain"
  | "insight"
  | "steps"
  | "proof"
  | "comparison"
  | "quote"
  | "story"
  | "cta"
  | "blank";

export type TextAlign = "left" | "center" | "right";

export interface SlideContent {
  headline: string;
  subheadline: string;
  body: string;
  subtext: string;
  ctaText: string;
}

export interface SlideImage {
  assetId: string;
  url: string;
  mode: "background" | "contained" | "side";
  x: number;      // percentage 0-100
  y: number;      // percentage 0-100
  width: number;   // percentage 10-100
  opacity: number; // 0-100
  // Crop region (% of image). Defaults to full image when absent.
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}

export interface SlideStyle {
  bgColor: string;
  bgImage: string | null;
  bgOverlayOpacity: number;
  headlineColor: string;
  subheadlineColor: string;
  bodyColor: string;
  subtextColor: string;
  ctaColor: string;
  ctaBgColor: string;
  accentColor: string;
  headlineFontSize: number;
  subheadlineFontSize: number;
  bodyFontSize: number;
  subtextFontSize: number;
  ctaFontSize: number;
  fontFamily: string;
  headlineWeight: "400" | "700" | "900";
  subheadlineWeight: "400" | "600" | "700" | "900";
  ctaAlign: "left" | "center" | "right";
  textAlign: TextAlign;
  lineSpacing: number;
  paddingX: number;
  paddingY: number;
  showLogo: boolean;
  showHandle: boolean;
  showAccent: boolean;
  accentStyle: "line" | "dot" | "bar" | "none";
  layout: SlideLayout;
}

export type SlideLayout =
  | "centered"
  | "top-heavy"
  | "bottom-heavy"
  | "split"
  | "full-bleed"
  | "hero-hook"
  | "quote-layout"
  | "story-layout"
  | "two-column"
  | "bullet-breakdown"
  | "framework-layout"
  | "comparison-layout"
  | "checklist";

// ── Free-form canvas element (Canva-style) ──

export interface CanvasElement {
  id: string;
  type: "text" | "image" | "shape";
  x: number;       // canvas pixels (0–1080)
  y: number;       // canvas pixels (0–1350)
  width: number;
  height: number;
  rotation: number;
  opacity: number; // 0–100
  locked: boolean;
  zIndex: number;
  // text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: "none" | "underline";
  // image
  assetId?: string;
  objectFit?: "cover" | "contain" | "fill";
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  // shape / shared
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  shapeType?: "rect" | "circle";
}

export interface Slide {
  id: string;
  type: SlideType;
  content: SlideContent;
  style: SlideStyle;
  image: SlideImage | null;
  elements?: CanvasElement[];
}

// ── Carousel metadata ──

export interface CarouselMeta {
  title: string;
  topic: string;
  audience: string;
  hook: string;
  coreMessage: string;
  supportingPoints: string;
  cta: string;
  caption: string;
  hashtags: string;
}

// ── Brand theme ──

export interface BrandTheme {
  id: string;
  name: string;
  bgColor: string;
  headlineColor: string;
  bodyColor: string;
  accentColor: string;
  ctaBgColor: string;
  ctaColor: string;
  fontFamily: string;
}

// ── Carousel framework ──

export interface CarouselFramework {
  id: string;
  name: string;
  description: string;
  icon: string;
  slideTypes: SlideType[];
}

// ── Constants ──

export const BRAND_FONTS = [
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Noto Sans", value: "'Noto Sans', sans-serif" },
  { label: "Inter", value: "'Inter', sans-serif" },
  { label: "Anton (Display)", value: "'Anton', cursive" },
  { label: "System", value: "system-ui, sans-serif" },
] as const;

export const BRAND_COLORS = [
  { label: "Forest Teal", value: "#002a27" },
  { label: "Bright Green", value: "#39de8b" },
  { label: "Forest Green", value: "#348050" },
  { label: "Gold", value: "#fbb700" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Off-white", value: "#f5f5f0" },
  { label: "Dark Slate", value: "#1a1a2e" },
  { label: "Warm Gray", value: "#2d2d2d" },
] as const;

export const SLIDE_TYPE_META: Record<SlideType, { label: string; icon: string; description: string }> = {
  hook: { label: "Hook", icon: "⚡", description: "Grab attention with a bold opener" },
  problem: { label: "Problem", icon: "🎯", description: "State the problem your audience faces" },
  pain: { label: "Pain / Tension", icon: "💥", description: "Amplify the pain point" },
  insight: { label: "Insight", icon: "💡", description: "Share the key insight or revelation" },
  steps: { label: "Steps / Framework", icon: "📋", description: "Break down actionable steps" },
  proof: { label: "Proof / Case Study", icon: "📊", description: "Show evidence or results" },
  comparison: { label: "Comparison", icon: "⚖️", description: "Compare before/after or myth/truth" },
  quote: { label: "Quote", icon: "💬", description: "A powerful quote or statement" },
  story: { label: "Story", icon: "📖", description: "Tell a compelling story" },
  cta: { label: "CTA", icon: "👉", description: "Drive action — follow, save, share" },
  blank: { label: "Blank", icon: "◻️", description: "Start from scratch" },
};

export const LAYOUT_PRESETS: { key: SlideLayout; label: string; icon: string }[] = [
  { key: "centered", label: "Centered", icon: "⊡" },
  { key: "top-heavy", label: "Top Heavy", icon: "⊤" },
  { key: "bottom-heavy", label: "Bottom", icon: "⊥" },
  { key: "hero-hook", label: "Hero Hook", icon: "⚡" },
  { key: "quote-layout", label: "Quote", icon: "❝" },
  { key: "story-layout", label: "Story", icon: "📖" },
  { key: "two-column", label: "Two Col", icon: "▥" },
  { key: "bullet-breakdown", label: "Bullets", icon: "•" },
  { key: "framework-layout", label: "Framework", icon: "▤" },
  { key: "comparison-layout", label: "Compare", icon: "⇔" },
  { key: "checklist", label: "Checklist", icon: "☑" },
  { key: "split", label: "Split", icon: "◧" },
  { key: "full-bleed", label: "Full Bleed", icon: "▣" },
];

export const DEFAULT_STYLE: SlideStyle = {
  bgColor: "#002a27",
  bgImage: null,
  bgOverlayOpacity: 60,
  headlineColor: "#ffffff",
  subheadlineColor: "rgba(255,255,255,0.7)",
  bodyColor: "#ffffff",
  subtextColor: "rgba(255,255,255,0.6)",
  ctaColor: "#002a27",
  ctaBgColor: "#39de8b",
  accentColor: "#39de8b",
  headlineFontSize: 36,
  subheadlineFontSize: 20,
  bodyFontSize: 18,
  subtextFontSize: 14,
  ctaFontSize: 16,
  fontFamily: "'Noto Sans', sans-serif",
  headlineWeight: "900",
  subheadlineWeight: "600",
  ctaAlign: "left",
  textAlign: "left",
  lineSpacing: 1.5,
  paddingX: 40,
  paddingY: 48,
  showLogo: true,
  showHandle: true,
  showAccent: true,
  accentStyle: "line",
  layout: "centered",
};

// ── Default brand themes ──

export const DEFAULT_THEMES: BrandTheme[] = [
  {
    id: "integrity-dark",
    name: "Integrity Dark",
    bgColor: "#002a27",
    headlineColor: "#ffffff",
    bodyColor: "#ffffff",
    accentColor: "#39de8b",
    ctaBgColor: "#39de8b",
    ctaColor: "#002a27",
    fontFamily: "'Noto Sans', sans-serif",
  },
  {
    id: "integrity-light",
    name: "Integrity Light",
    bgColor: "#f5f5f0",
    headlineColor: "#002a27",
    bodyColor: "#1a1a1a",
    accentColor: "#39de8b",
    ctaBgColor: "#002a27",
    ctaColor: "#ffffff",
    fontFamily: "'Noto Sans', sans-serif",
  },
  {
    id: "bold-black",
    name: "Bold Black",
    bgColor: "#000000",
    headlineColor: "#ffffff",
    bodyColor: "#cccccc",
    accentColor: "#fbb700",
    ctaBgColor: "#fbb700",
    ctaColor: "#000000",
    fontFamily: "'Inter', sans-serif",
  },
  {
    id: "clean-white",
    name: "Clean White",
    bgColor: "#ffffff",
    headlineColor: "#111111",
    bodyColor: "#444444",
    accentColor: "#348050",
    ctaBgColor: "#348050",
    ctaColor: "#ffffff",
    fontFamily: "'Inter', sans-serif",
  },
  {
    id: "forest-gold",
    name: "Forest & Gold",
    bgColor: "#1a1a2e",
    headlineColor: "#fbb700",
    bodyColor: "#e0e0e0",
    accentColor: "#fbb700",
    ctaBgColor: "#fbb700",
    ctaColor: "#1a1a2e",
    fontFamily: "'Noto Sans', sans-serif",
  },

  // ── Integrity Pre-sets (matched to Groundwork Collection brand slides) ──

  {
    id: "integrity-groundwork-editorial",
    name: "Groundwork Editorial",
    bgColor: "#ECE7DE",
    headlineColor: "#0B2820",
    bodyColor: "#2A3830",
    accentColor: "#1CC4AC",
    ctaBgColor: "#ECE7DE",
    ctaColor: "#1CC4AC",
    fontFamily: "'Noto Sans', sans-serif",
  },
  {
    id: "integrity-field-documentary",
    name: "Field Documentary",
    bgColor: "#141C16",
    headlineColor: "#FFFFFF",
    bodyColor: "#D8D8D4",
    accentColor: "#1CC4AC",
    ctaBgColor: "#141C16",
    ctaColor: "#1CC4AC",
    fontFamily: "'Noto Sans', sans-serif",
  },
  {
    id: "integrity-canopy-atmosphere",
    name: "Canopy Atmosphere",
    bgColor: "#1A2820",
    headlineColor: "#FFFFFF",
    bodyColor: "#C8D8D0",
    accentColor: "#1CC4AC",
    ctaBgColor: "#1A2820",
    ctaColor: "#1CC4AC",
    fontFamily: "'Noto Sans', sans-serif",
  },
];

// ── Carousel frameworks ──

export const CAROUSEL_FRAMEWORKS: CarouselFramework[] = [
  {
    id: "5-mistakes",
    name: "5 Mistakes",
    description: "Hook → 5 common mistakes → CTA",
    icon: "❌",
    slideTypes: ["hook", "problem", "problem", "problem", "problem", "problem", "insight", "cta"],
  },
  {
    id: "3-step",
    name: "3-Step Framework",
    description: "Hook → 3 actionable steps → CTA",
    icon: "🔢",
    slideTypes: ["hook", "steps", "steps", "steps", "cta"],
  },
  {
    id: "before-after",
    name: "Before / After",
    description: "Hook → before → pain → after → how → CTA",
    icon: "🔄",
    slideTypes: ["hook", "comparison", "pain", "comparison", "steps", "cta"],
  },
  {
    id: "myth-truth",
    name: "Myth vs Truth",
    description: "Hook → myth/truth pairs → insight → CTA",
    icon: "⚖️",
    slideTypes: ["hook", "comparison", "comparison", "comparison", "insight", "cta"],
  },
  {
    id: "how-to",
    name: "How-To Breakdown",
    description: "Hook → problem → step-by-step → proof → CTA",
    icon: "🛠️",
    slideTypes: ["hook", "problem", "steps", "steps", "steps", "proof", "cta"],
  },
  {
    id: "unpopular-opinion",
    name: "Unpopular Opinion",
    description: "Contrarian hook → reasoning → evidence → CTA",
    icon: "🔥",
    slideTypes: ["hook", "insight", "proof", "proof", "cta"],
  },
  {
    id: "story-lesson",
    name: "Story to Lesson",
    description: "Story hook → narrative → lesson → CTA",
    icon: "📖",
    slideTypes: ["hook", "story", "story", "pain", "insight", "steps", "cta"],
  },
];

// ── Hook bank ──

export const HOOK_BANK = [
  "Stop doing this if you want to grow",
  "Nobody talks about this...",
  "I wish someone told me this sooner",
  "The truth about [topic] that nobody wants to hear",
  "Why most people stay stuck",
  "This changed everything for me",
  "The #1 mistake I see every day",
  "Here's what actually works",
  "Unpopular opinion about [topic]",
  "The simple framework that 10x'd my results",
  "3 things I'd do differently",
  "If you're still doing this, stop",
  "What nobody tells you about growth",
  "This is why your content isn't converting",
  "Read this if you're ready to level up",
];

// ── CTA bank ──

export const CTA_BANK = [
  "Save this for later",
  "Share with someone who needs this",
  "Follow for more insights",
  "Drop a 🔥 if you agree",
  "Tag someone who needs to hear this",
  "Comment 'YES' if you're ready",
  "Link in bio for the full guide",
  "DM me 'START' for the free resource",
  "Double tap if this resonated",
  "Which one surprised you? Comment below",
  "Follow @handle for daily growth tips",
  "Save this post — you'll need it",
];

// ── Strategy suggestions ──

export interface StrategySuggestion {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const STRATEGY_SUGGESTIONS: StrategySuggestion[] = [
  { id: "hook-strength", label: "Strengthen the hook", description: "Make slide 1 impossible to scroll past", icon: "⚡" },
  { id: "shorten-text", label: "Make slides shorter", description: "Instagram users skim — cut 30% of text", icon: "✂️" },
  { id: "add-curiosity", label: "Increase curiosity", description: "Add open loops and cliffhangers between slides", icon: "❓" },
  { id: "readability", label: "Improve readability", description: "Bigger fonts, shorter lines, more contrast", icon: "👁️" },
  { id: "clearer-cta", label: "Make CTA clearer", description: "One specific action — save, share, or follow", icon: "👉" },
  { id: "tighten-copy", label: "Tighten language", description: "Remove filler words, use punchy sentences", icon: "💎" },
];

// ── Helpers ──

let _slideCounter = 0;

function sc(headline: string, subheadline: string, body: string, subtext: string, ctaText: string): SlideContent {
  return { headline, subheadline, body, subtext, ctaText };
}

export function createSlide(type: SlideType, styleOverrides?: Partial<SlideStyle>): Slide {
  _slideCounter++;
  const defaults = getTypeDefaults(type);
  return {
    id: `slide-${Date.now()}-${_slideCounter}`,
    type,
    content: defaults.content,
    style: { ...DEFAULT_STYLE, ...defaults.style, ...styleOverrides },
    image: null,
  };
}

function getTypeDefaults(type: SlideType): { content: SlideContent; style: Partial<SlideStyle> } {
  switch (type) {
    case "hook":
      return {
        content: sc("Your hook goes here", "", "", "Swipe to learn more →", ""),
        style: { headlineFontSize: 42, headlineWeight: "900", layout: "hero-hook", textAlign: "center" },
      };
    case "problem":
      return {
        content: sc("The problem", "", "Most people struggle with this because...", "", ""),
        style: { headlineFontSize: 32, layout: "top-heavy" },
      };
    case "pain":
      return {
        content: sc("Sound familiar?", "", "You've tried everything but nothing seems to work. The frustration is real.", "", ""),
        style: { headlineFontSize: 32, layout: "centered" },
      };
    case "insight":
      return {
        content: sc("Here's the truth", "", "The key insight that changes everything...", "", ""),
        style: { headlineFontSize: 34, accentColor: "#fbb700", layout: "centered" },
      };
    case "steps":
      return {
        content: sc("Step 1", "", "Start with this specific action...", "This alone will make a difference", ""),
        style: { headlineFontSize: 32, layout: "top-heavy" },
      };
    case "proof":
      return {
        content: sc("The results speak", "", "Before: struggling\nAfter: thriving", "Real results from real people", ""),
        style: { headlineFontSize: 30, layout: "centered" },
      };
    case "comparison":
      return {
        content: sc("Myth vs Reality", "", "❌ What most people think\n✅ What actually works", "", ""),
        style: { headlineFontSize: 30, layout: "comparison-layout", textAlign: "left" },
      };
    case "quote":
      return {
        content: sc('"Your powerful quote here"', "", "", "— Attribution", ""),
        style: { headlineFontSize: 28, headlineWeight: "700", layout: "quote-layout", textAlign: "center" },
      };
    case "story":
      return {
        content: sc("Let me tell you a story...", "", "It started when...", "", ""),
        style: { headlineFontSize: 28, layout: "story-layout" },
      };
    case "cta":
      return {
        content: sc("Ready to start?", "", "Take the first step today", "", "Follow for more"),
        style: { headlineFontSize: 36, headlineWeight: "900", layout: "centered", textAlign: "center", ctaBgColor: "#39de8b", ctaColor: "#002a27" },
      };
    default:
      return {
        content: sc("", "", "", "", ""),
        style: {},
      };
  }
}

// ── Seed carousels ──

export interface SeedCarousel {
  id: string;
  title: string;
  meta: Partial<CarouselMeta>;
  slides: Slide[];
}

function seedSlide(type: SlideType, content: SlideContent, styleOverrides: Partial<SlideStyle>): Slide {
  return { ...createSlide(type), content, style: { ...DEFAULT_STYLE, ...styleOverrides } };
}

export function getSeedCarousels(): SeedCarousel[] {
  return [
    {
      id: "seed-1",
      title: "Why most people stay broke",
      meta: {
        topic: "Financial growth mindset",
        audience: "Entrepreneurs, young professionals",
        hook: "Why most people stay broke",
        coreMessage: "Wealth requires mindset shifts, not just tactics",
        cta: "Follow for more wealth insights",
        caption: "The truth about money that nobody teaches in school. Save this and share it with someone who needs to hear it.",
        hashtags: "#wealthmindset #financialfreedom #growthmindset #moneytips #entrepreneurlife",
      },
      slides: [
        seedSlide("hook", sc("Why most people\nstay broke", "", "", "Swipe to find out →", ""), { headlineFontSize: 44, headlineWeight: "900", layout: "centered", textAlign: "center", bgColor: "#000000", accentColor: "#fbb700" }),
        seedSlide("problem", sc("They trade time\nfor money", "", "Working harder won't make you wealthy. Working smarter will.", "Mistake #1", ""), { headlineFontSize: 34, bgColor: "#1a1a2e", accentColor: "#fbb700" }),
        seedSlide("problem", sc("They avoid\ndiscomfort", "", "Growth happens outside your comfort zone. Every single time.", "Mistake #2", ""), { headlineFontSize: 34, bgColor: "#1a1a2e", accentColor: "#fbb700" }),
        seedSlide("problem", sc("They spend\nbefore investing", "", "Rich people invest first, spend what's left. Most people do the opposite.", "Mistake #3", ""), { headlineFontSize: 34, bgColor: "#1a1a2e", accentColor: "#fbb700" }),
        seedSlide("insight", sc("Wealth is a\nmindset first", "", "Change how you think about money and everything else follows.", "", ""), { headlineFontSize: 38, headlineWeight: "900", bgColor: "#002a27", headlineColor: "#fbb700", textAlign: "center", layout: "centered" }),
        seedSlide("cta", sc("Ready to change\nyour money story?", "", "Save this. Share it. Start today.", "", "Follow for more"), { headlineFontSize: 34, bgColor: "#000000", headlineColor: "#fbb700", textAlign: "center", layout: "centered" }),
      ],
    },
    {
      id: "seed-2",
      title: "3 mistakes brands make on Instagram",
      meta: {
        topic: "Instagram strategy",
        audience: "Brand owners, social media managers",
        hook: "3 mistakes killing your Instagram growth",
        coreMessage: "Common Instagram mistakes are easy to fix",
        cta: "Share with your marketing team",
        caption: "Stop making these mistakes. Your growth depends on it. Save this for your next content planning session.",
        hashtags: "#instagramgrowth #socialmediatips #brandstrategy #contentmarketing #growthhacking",
      },
      slides: [
        seedSlide("hook", sc("3 Mistakes\nKilling Your\nInstagram Growth", "", "", "Are you making these? →", ""), { headlineFontSize: 40, headlineWeight: "900", layout: "centered", textAlign: "center", bgColor: "#002a27" }),
        seedSlide("problem", sc("Posting without\na strategy", "", "Random content = random results.\nEvery post should have a purpose.", "Mistake #1", ""), { headlineFontSize: 32, bgColor: "#002a27" }),
        seedSlide("problem", sc("Ignoring\nyour analytics", "", "The data tells you exactly what works.\nStop guessing, start measuring.", "Mistake #2", ""), { headlineFontSize: 32, bgColor: "#002a27" }),
        seedSlide("problem", sc("Chasing trends\nover value", "", "Trends get views. Value gets followers.\nDo both — but lead with value.", "Mistake #3", ""), { headlineFontSize: 32, bgColor: "#002a27" }),
        seedSlide("insight", sc("Fix these 3 things\nand watch your\ngrowth explode", "", "It's not about doing more.\nIt's about doing what works.", "", ""), { headlineFontSize: 30, bgColor: "#002a27", headlineColor: "#39de8b", textAlign: "center", layout: "centered" }),
        seedSlide("cta", sc("Want more\ngrowth strategies?", "", "", "", "Follow + Save"), { headlineFontSize: 36, bgColor: "#002a27", textAlign: "center", layout: "centered" }),
      ],
    },
    {
      id: "seed-3",
      title: "How to build authority with content",
      meta: {
        topic: "Content authority building",
        audience: "Creators, coaches, thought leaders",
        hook: "How to become the go-to expert in your niche",
        coreMessage: "Authority is built through consistent, value-driven content",
        cta: "Follow for daily content strategies",
        caption: "Authority isn't given — it's earned through your content. Here's the framework I used to build mine.",
        hashtags: "#contentcreator #thoughtleadership #personalbranding #authority #contentmarketing",
      },
      slides: [
        seedSlide("hook", sc("How to Build\nAuthority With\nContent", "", "", "The 3-step framework →", ""), { headlineFontSize: 40, headlineWeight: "900", bgColor: "#000000", textAlign: "center", layout: "centered" }),
        seedSlide("steps", sc("Step 1:\nPick Your Lane", "", "Choose ONE topic.\nGo deeper than anyone else.\nSpecificity is your advantage.", "", ""), { headlineFontSize: 32, bgColor: "#000000", headlineColor: "#39de8b" }),
        seedSlide("steps", sc("Step 2:\nTeach Relentlessly", "", "Share your best ideas for free.\nThe more you give, the more authority you build.", "", ""), { headlineFontSize: 32, bgColor: "#000000", headlineColor: "#39de8b" }),
        seedSlide("steps", sc("Step 3:\nShow Receipts", "", "Share results, case studies, behind-the-scenes.\nProof makes you undeniable.", "", ""), { headlineFontSize: 32, bgColor: "#000000", headlineColor: "#39de8b" }),
        seedSlide("proof", sc("This framework\nworks because...", "", "People follow experts who give value first.\nConsistency + specificity = authority.", "", ""), { headlineFontSize: 30, bgColor: "#000000", textAlign: "center", layout: "centered" }),
        seedSlide("cta", sc("Start building\nyour authority\ntoday", "", "", "", "Follow for more"), { headlineFontSize: 36, bgColor: "#000000", headlineColor: "#39de8b", textAlign: "center", layout: "centered" }),
      ],
    },
    {
      id: "seed-4",
      title: "The real reason your content isn't converting",
      meta: {
        topic: "Content conversion",
        audience: "Business owners, content creators",
        hook: "The real reason your content isn't converting",
        coreMessage: "Content converts when it speaks to a specific person with a specific problem",
        cta: "Save this for your next content audit",
        caption: "If your content gets likes but not leads, this is for you. The fix is simpler than you think.",
        hashtags: "#contentconversion #digitalmarketing #leadgeneration #contentmarketing #socialmediamarketing",
      },
      slides: [
        seedSlide("hook", sc("The Real Reason\nYour Content\nIsn't Converting", "", "", "It's not what you think →", ""), { headlineFontSize: 38, headlineWeight: "900", bgColor: "#1a1a2e", textAlign: "center", layout: "centered" }),
        seedSlide("pain", sc("You're creating\nfor everyone", "", "Content for everyone resonates with no one.\nYou need to speak to ONE person.", "", ""), { headlineFontSize: 32, bgColor: "#1a1a2e" }),
        seedSlide("comparison", sc("Likes ≠ Leads", "", "❌ \"Great tips!\" comments\n✅ \"How can I work with you?\" DMs\n\nYou want the second one.", "", ""), { headlineFontSize: 34, bgColor: "#1a1a2e" }),
        seedSlide("insight", sc("The fix is\nsimplicity", "", "1. Specific audience\n2. Specific problem\n3. Specific solution\n4. Specific CTA", "", ""), { headlineFontSize: 32, bgColor: "#1a1a2e", headlineColor: "#fbb700" }),
        seedSlide("steps", sc("Audit every\npost with:", "", "\"Who is this for?\"\n\"What problem does it solve?\"\n\"What should they do next?\"", "If you can't answer all 3, rework it.", ""), { headlineFontSize: 30, bgColor: "#1a1a2e" }),
        seedSlide("cta", sc("Content that\nconverts starts here", "", "", "", "Save + Share"), { headlineFontSize: 34, bgColor: "#1a1a2e", headlineColor: "#fbb700", textAlign: "center", layout: "centered" }),
      ],
    },
  ];
}

export const DEFAULT_META: CarouselMeta = {
  title: "",
  topic: "",
  audience: "",
  hook: "",
  coreMessage: "",
  supportingPoints: "",
  cta: "",
  caption: "",
  hashtags: "",
};
