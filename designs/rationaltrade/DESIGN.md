---
name: RationalTrade
colors:
  surface: '#051425'
  surface-dim: '#051425'
  surface-bright: '#2c3a4d'
  surface-container-lowest: '#010f20'
  surface-container-low: '#0d1c2e'
  surface-container: '#122032'
  surface-container-high: '#1d2b3d'
  surface-container-highest: '#283648'
  on-surface: '#d5e3fc'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#d5e3fc'
  inverse-on-surface: '#233144'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#68dba9'
  on-secondary: '#003825'
  secondary-container: '#25a475'
  on-secondary-container: '#00311f'
  tertiary: '#ffb3b6'
  on-tertiary: '#68001a'
  tertiary-container: '#c20038'
  on-tertiary-container: '#ffd0d2'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b6'
  on-tertiary-fixed: '#40000c'
  on-tertiary-fixed-variant: '#920028'
  background: '#051425'
  on-background: '#d5e3fc'
  surface-variant: '#283648'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1280px
---

## Brand & Style

The design system is engineered for analytical rigor and emotional neutrality. It targets professional traders who require a focused, distraction-free environment for post-trade reflection and data entry. 

The aesthetic follows a **Modern Corporate** style with high-density information layouts. It prioritizes clarity over decoration, using a sophisticated dark palette to reduce eye strain during long sessions of market analysis. The visual language conveys precision, reliability, and the "rational" mindset required for successful trading.

## Colors

The palette is rooted in deep slates to create a sense of depth and hierarchy without the harshness of pure black. 

- **Primary (Indigo-600):** Reserved for core navigational actions, focus states, and primary CTAs.
- **Success/Buy (Emerald-600):** Specifically used for profitable trades, "Buy" signals, and positive delta.
- **Danger/Sell (Rose-600):** Used for losses, "Sell" signals, and negative delta.
- **Neutral/Observe (Slate-600):** Utilized for break-even trades, "Watchlist" items, and secondary metadata.
- **Borders (Slate-800):** Provides subtle structural definition between data modules.

## Typography

This design system utilizes **Inter** for its exceptional legibility and neutral character. A critical requirement for this financial application is the use of **Tabular Figures** (`tnum`) for all numerical data, ensuring that columns of numbers align perfectly for easy scanning and comparison.

- **Headlines:** Bold and tight to anchor the page layout.
- **Body:** Sized for comfortable reading of trade rationales and notes.
- **Labels:** Uppercase with slight tracking for category headers and table metadata.
- **Data Mono:** A specific role for P&L, entry prices, and timestamps, utilizing Inter's tabular figure features.

## Layout & Spacing

The system employs a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **Data Density:** Layouts should be compact but not crowded. Use a consistent 4px base unit. 
- **Gutters:** Standardized at 16px to maintain a rhythmic separation between data widgets.
- **Responsive Behavior:** On tablet/desktop, use a "Dashboard" view with sidebar navigation. On mobile, transition to a "Bottom Sheet" navigation model for ease of thumb-reach during quick trade entry.
- **Margins:** 32px on desktop to allow the UI to breathe; 16px on mobile to maximize screen real estate for charts and logs.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** rather than traditional shadows. This maintains the sleek, "built-in" feel of a professional trading terminal.

- **Level 0 (Base):** Slate-950 for the main application background.
- **Level 1 (Surface):** Slate-900 for cards, data tables, and input containers.
- **Level 2 (Overlay):** Slate-800 for modals, tooltips, and popovers, featuring a subtle 1px border in a slightly lighter shade to define edges.
- **Interactions:** Subtle background-color shifts (e.g., Slate-900 to Slate-800) are used for hover states on list items and buttons.

## Shapes

The design system uses a **Rounded** language to soften the density of financial data.

- **Cards:** 16px (1rem) corner radius for a modern, containerized feel.
- **Input Fields/Buttons:** 8px (0.5rem) to balance professional structure with approachable interaction points.
- **Pills/Tags:** Fully rounded (pill-shaped) for status indicators (e.g., "Win", "Loss", "Breakeven") and segmented controller active states.

## Components

### Buttons
- **Primary:** Solid Indigo-600 background with white text. High contrast is mandatory.
- **Success/Danger:** Solid Emerald or Rose backgrounds specifically for "Add Buy" or "Add Sell" actions.
- **Ghost:** Transparent background with Slate-800 borders for secondary actions like "Cancel" or "Export."

### Segmented Controllers
Used for switching timeframes or trade views. The container uses a Slate-950 background with a 4px padding. The active state is a Slate-800 pill that slides beneath the text, providing a clear visual "selected" indicator.

### Cards
All data modules (P&L Chart, Trade List, Win Rate) must be contained in 16px rounded cards using the Surface (Slate-900) color. Borders should be minimal (1px Slate-800).

### Input Fields
Dark backgrounds (Slate-950) with subtle 1px Slate-800 borders. Focus states must use a 2px Indigo-600 ring. Labels are positioned above the field in `label-md` typography.

### Data Tables
Rows should have a subtle hover state (Slate-800). Numerical columns must be right-aligned to ensure decimal points align visually.

### Chips/Badges
Used for tagging strategies (e.g., "Scalp", "Trend Follow"). These use a low-opacity background of the primary color with centered text to keep the UI clean.