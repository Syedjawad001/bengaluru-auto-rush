/**
 * Design tokens for Bengaluru Auto Rush.
 *
 * These values mirror the CSS custom properties in index.css so game logic
 * and UI code share a single source of truth for colours, typography,
 * spacing, and borders.
 *
 * Usage in components:  className={`bg-[${tokens.color.accent}]`}
 * Usage in canvas/game: ctx.fillStyle = tokens.color.accent
 */

export const tokens = {
  color: {
    // ── Brand ───────────────────────────────────────────────────────────
    accent: "#aa3bff",
    accentDark: "#c084fc",
    accentBg: "rgba(170, 59, 255, 0.1)",
    accentBgDark: "rgba(192, 132, 252, 0.15)",
    accentBorder: "rgba(170, 59, 255, 0.5)",
    accentBorderDark: "rgba(192, 132, 252, 0.5)",

    // ── Surfaces ─────────────────────────────────────────────────────────
    bg: "#ffffff",
    bgDark: "#16171d",
    codeBg: "#f4f3ec",
    codeBgDark: "#1f2028",
    socialBg: "rgba(244, 243, 236, 0.5)",
    socialBgDark: "rgba(47, 48, 58, 0.5)",

    // ── Text ─────────────────────────────────────────────────────────────
    text: "#6b6375",
    textDark: "#9ca3af",
    textHeading: "#08060d",
    textHeadingDark: "#f3f4f6",

    // ── Borders ───────────────────────────────────────────────────────────
    border: "#e5e4e7",
    borderDark: "#2e303a",

    // ── Game UI ──────────────────────────────────────────────────────────
    hpFull: "#22c55e",    // green — health bar
    hpLow: "#ef4444",     // red   — low health
    mana: "#3b82f6",      // blue  — mana / turbo bar
    xp: "#f59e0b",        // amber — XP / score bar
    road: "#2d2f3a",      // dark  — road surface
    roadLine: "#f8f8f2",  // white — road markings
  },

  font: {
    retro: "'Press Start 2P', system-ui, sans-serif",
    sans: "system-ui, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, Consolas, monospace",
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    "2xl": "48px",
    "3xl": "64px",
  },

  border: {
    pixel: "2px solid",
    pixelThick: "4px solid",
    radius: "0px",         // 8-bit = square corners everywhere
    radiusSm: "2px",       // allow minor softening when needed
  },

  zIndex: {
    road: 0,
    vehicle: 10,
    character: 20,
    projectile: 30,
    ui: 100,
    overlay: 200,
    modal: 300,
  },
} as const;

export type Tokens = typeof tokens;
