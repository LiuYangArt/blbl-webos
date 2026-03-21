# Design System: The Cinematic Canvas

## 1. Overview & Creative North Star
**Creative North Star: "The Neon Curator"**

This design system reimagines the Bilibili experience for the 10-foot viewing environment. We are moving away from the cluttered, information-dense layout of the mobile app toward a "Cinematic Editorial" approach. By leveraging high-contrast dark surfaces and the brand’s signature vibrance, we create a UI that feels less like a software interface and more like a premium digital gallery.

To break the "template" look, we utilize **intentional asymmetry**—offsetting hero text against expansive negative space—and **tonal depth**. We replace rigid grid lines with soft light-play, using the signature Pink and Blue not just as colors, but as "light sources" that guide the user’s eye across the living room.

---

## 2. Colors & Surface Philosophy
The palette is rooted in deep obsidian tones to minimize eye strain and maximize the "pop" of OLED displays.

*   **Primary (#FB7299):** Used for critical focus states and high-energy CTAs.
*   **Secondary (#00A1D6):** Used for functional accents, progress bars, and secondary metadata.
*   **The "No-Line" Rule:** 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined solely through background shifts. For example, a `surface-container-low` rail sitting on a `surface` background provides all the separation needed without visual noise.
*   **Surface Hierarchy & Nesting:** 
    *   **Background (`#131314`):** The base canvas.
    *   **Surface Container Low (`#1c1b1c`):** For secondary content areas (e.g., side navigation rails).
    *   **Surface Container High (`#2a2a2b`):** For interactive elements like cards or buttons.
*   **The "Glass & Gradient" Rule:** Floating overlays (menus, player controls) must use Glassmorphism. Utilize semi-transparent surface colors with a `20px` to `40px` backdrop-blur.
*   **Signature Textures:** Apply a linear gradient from `primary` (#FB7299) to `primary_container` (#FB7299 at 70% opacity) on hero "Play" buttons to provide a lustrous, tactile quality.

---

## 3. Typography
We utilize a dual-font system to balance personality with extreme legibility.

*   **Display & Headlines (Plus Jakarta Sans):** Chosen for its modern, geometric clarity. Use `display-lg` for featured titles to create an authoritative editorial feel. The generous x-height ensures readability from 10 feet away.
*   **Body & Titles (Be Vietnam Pro):** A highly legible sans-serif used for descriptions and metadata. 
*   **Hierarchy as Identity:** Use `headline-lg` for category headers to establish a "magazine" feel. Metadata (durations, view counts) should use `label-md` with `on_surface_variant` to recede visually, ensuring the title remains the hero.

---

## 4. Elevation & Depth
In a D-pad driven interface, depth is the primary indicator of focus.

*   **The Layering Principle:** Stack surfaces to create natural "lift." Place a `surface-container-highest` card on a `surface-container-low` background to signal importance.
*   **Ambient Shadows:** Floating modals must use "Neon Shadows." Instead of black, use a `primary` or `secondary` tinted shadow at 8% opacity with a `48px` blur to simulate the glow of the screen reflecting off the wall.
*   **The "Ghost Border" Fallback:** If a container requires a boundary (e.g., a search input), use the `outline_variant` token at **15% opacity**. Never use 100% opaque lines.
*   **Focus States:** This is the most critical element. When a D-pad move lands on an item, it must **scale by 1.05x** and gain a `2px` outer glow using the `primary` (Pink) token. This "breath" effect makes the UI feel alive.

---

## 5. Components

### Cards & Lists (The Editorial Grid)
*   **Rule:** Forbid the use of divider lines. Separate video items using `spacing-6` (2rem) of horizontal white space.
*   **Styling:** Cards should have a `roundedness-lg` (1rem) corner radius. The "Selected" card state adds a soft `surface-bright` inner glow.

### Buttons (The Action Pair)
*   **Primary:** Background: `primary_container`. Text: `on_primary`. Shape: `roundedness-full`. Use for "Watch Now."
*   **Secondary:** Background: `surface_container_highest`. Text: `on_surface`. Use for "Add to List."
*   **States:** Upon focus, the button should pulse slightly and the background color should shift to the `primary` token for maximum vibrance.

### Side Navigation (The Anchor)
*   **Layout:** A slim rail on the left. On focus, it expands into a `surface-container-low` drawer with a `backdrop-blur`.
*   **Icons:** Use `secondary` (#00A1D6) for active icons to provide a cool contrast against the pink focus glow of the main content.

### Progress Bars
*   **Track:** `surface_container_highest`.
*   **Indicator:** A gradient from `secondary` to `secondary_fixed`. This differentiates functional "system" feedback from "brand" interaction (pink).

---

## 6. Do’s and Don’ts

### Do
*   **DO** use `spacing-20` or `spacing-24` for outer margins to ensure content stays within the "Action Safe" zone of older TV panels.
*   **DO** use `title-lg` for video titles; on TV, bigger is always better for the "Lean Back" experience.
*   **DO** use asymmetry. Place a hero image on the right 60% of the screen and the text/actions on the left 40% for a premium, custom look.

### Don't
*   **DON'T** use pure white (#FFFFFF) for text. Use `on_surface` (#e5e2e3) to prevent "blooming" or "halos" on high-brightness screens.
*   **DON'T** use 1px dividers. They disappear or flicker on 4K TV scaling. Use vertical white space (`spacing-8`) instead.
*   **DON'T** overcrowd the screen. If you can't read it from 10 feet, it doesn't belong in the view. Use horizontal scrolling carousels instead of vertical stacks where possible.