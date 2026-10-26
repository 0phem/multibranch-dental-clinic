# Dr. Dana E. Roxas Dental Clinic — Design System & Style Guide
## Global UI/UX Standards (GEN-08)

This style guide establishes the shared design language, tokens, component standards, and accessibility patterns for the **Web-Based Multi-Branch Dental Clinic Operation System**. It covers all four product surfaces: **Patient Portal**, **Staff Dashboard**, **Dentist Dashboard**, and **Owner Dashboard**.

---

## 1. Design Principles

1. **Healthcare Clarity**: Clean, calm, high-contrast visual design prioritizing patient safety and legibility over decorative flourishes.
2. **Deterministic UI**: Never hide critical actions behind obscure gestures; every interactive control provides clear focus, hover, disabled, and loading states.
3. **Responsive Consistency**: 0px horizontal overflow across all standard viewports:
   - **Mobile**: `375px` to `767px` (single-column, tap target >= 44px)
   - **Tablet**: `768px` to `1023px` (adaptive cards, touch-optimized)
   - **Desktop**: `1024px` to `1440px+` (master-detail layouts, sticky headers)
4. **Non-Destructive Workflows**: Administrative or clinical removals default to soft-delete (Archive) with mandatory audit logging and role-based access control.

---

## 2. Design Tokens

### 2.1 Color Palette

| Token Name | Hex Value | Purpose / Usage |
|:---|:---|:---|
| `--brand` | `#0b7f75` | Primary clinical teal, header accents, active tabs, CTA buttons |
| `--brand-hover` | `#086960` | Interactive hover state for primary brand elements |
| `--brand-soft` | `#e6f5f3` | Subtle teal tint for backgrounds, highlights, and active items |
| `--ink` / `--text` | `#0f172a` | Primary text and headings (Slate 900) |
| `--muted` | `#64748b` | Supporting text, captions, timestamps, placeholders (Slate 500) |
| `--surface` | `#ffffff` | Primary card, modal, and input surface |
| `--surface-2` | `#f8fafc` | Subtle page background, alternating table rows, past calendar days |
| `--surface-3` | `#f1f5f9` | Control hovers, disabled controls, badge backgrounds |
| `--line` | `#e2e8f0` | Standard dividing lines, card borders, table borders |
| `--line-strong` | `#cbd5e1` | Input borders, dropdown boundaries, interactive borders |
| `--danger` | `#c2412b` | Cancellation, retraction, overdue warnings, destructive confirmations |
| `--warning` | `#b26a00` | Partial leaves, unverified records, capacity warnings |
| `--info` | `#1865ac` | General informational notices, verified status badges |
| `--success` | `#0c7f75` | Confirmed appointments, paid invoices, consent recorded |

### 2.2 Typography Scale

The system uses modern system typography (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) with strict hierarchy:

- **Heading 1 (`h1`)**: `clamp(1.2rem, 1.8vw, 1.45rem)`, Weight: 700, Line-height: 1.25
- **Card Title (`h2`)**: `1.125rem` (`18px`), Weight: 600, Line-height: 1.35
- **Body (`--font-body`)**: `0.875rem` (`14px`), Weight: 400, Line-height: 1.5
- **Medium UI (`--font-md`)**: `0.875rem` (`14px`), Weight: 500
- **Small UI (`--font-sm`)**: `0.8125rem` (`13px`), Weight: 400
- **Extra Small / Badges (`--font-xs`)**: `0.6875rem` (`11px`), Weight: 600, Letter-spacing: `0.03em`
- **Page Kicker**: `0.6875rem` (`11px`), Weight: 700, Uppercase, Letter-spacing: `0.06em`

### 2.3 Radii & Elevation

- `--radius-sm`: `6px` (badges, small tags, sub-controls)
- `--radius`: `10px` (inputs, buttons, filter bars, notifications)
- `--radius-lg`: `14px` (cards, modals, flyouts)
- `--radius-full`: `9999px` (avatars, pills, status pills)
- `--shadow-xs`: `0 1px 2px rgba(0, 0, 0, 0.05)`
- `--shadow-sm`: `0 2px 4px rgba(0, 0, 0, 0.08)`
- `--shadow-md`: `0 4px 12px rgba(0, 0, 0, 0.12)`

---

## 3. Standard Shared Components

### 3.1 Buttons (`Button`, `RefreshButton`) (GEN-12, GEN-13)
- **Standard Button (`.btn`)**: `min-height: 38px; padding: 7px 14px; font-size: 14px;`
- **Small Button (`.btn.sm`)**: `min-height: 32px; padding: 4px 10px; font-size: 13px;`
- **Large Button (`.btn.lg`)**: `min-height: 44px; padding: 10px 18px; font-size: 16px;`
- **Variants**: `primary`, `secondary`, `soft`, `ghost`, `danger`.
- **Refresh Control (`RefreshButton`)**: Icon-only button (`<Icon name="refresh"/>`) with animated CSS keyframe spin during active refresh, accessible tooltip, and `aria-label="Refresh"`. No raw "Refresh" text buttons.

### 3.2 Search & Filters (`FilterBar`, `SearchInput`) (GEN-02, GEN-04)
- **Search Input (`SearchInput`)**: Centered search icon on the left (`12px`), text padding indented to `36px` to prevent text overlap, and dynamic right "X" clear button.
- **Filter Bar (`FilterBar`)**: Unified responsive wrapper. Replaces all text "Clear filters" buttons with an accessible icon button (`<Icon name="x"/>`, `title="Clear filters"`, `aria-label="Clear filters"`).

### 3.3 Dropdown "Other -> Specify" Pattern (GEN-07)
- **Dropdown with Other (`SelectWithOther`)**: Standardizes all dropdowns offering an "Other" option.
- When "Other" is selected, dynamically renders a mandatory text field:
  - Sex/Gender: "Please specify sex / gender"
  - Leave Type: "Specify reason (required for Other)"
  - Document Upload: "Specify Document Description"
  - ID Verification: "Specify ID type (e.g. PhilHealth, Company ID)"

### 3.4 Shared Calendar (`StaffDayCalendar`) (GEN-14, OWN-08)
- Displays appointment entries as clean, circular patient avatars in day cells.
- Maximum 3 avatars rendered per day cell; overflowing appointments collapse to `+N` badge (e.g. `+2`).
- Clicking `+N` or any avatar selects the date and opens the expanded details pane.
- Past dates (`c.date < today`) are greyed out (`.past-day`, 75% opacity) while remaining selectable and fully viewable.

### 3.5 Notification Bell Button (GEN-03)
- Borderless and outline-free in default, hover, and click states across both staff topbar (`.top-icon-btn`) and patient header (`.pp-bell`).
- Uses subtle teal background on hover (`rgba(11, 127, 117, 0.08)`) and high-visibility focus ring on `:focus-visible` only.

---

## 4. Accessibility & Quality Rules

1. All forms label inputs with explicit `<label>` or `aria-label`.
2. Error messages associate with controls via `aria-describedby` and render with `role="alert"`.
3. Modal dialogs trap focus, prevent background scroll, and close on `Escape` or backdrop click.
4. Color is never the sole conveyor of information: status badges include text and icon indicators.
5. All times and dates are evaluated and rendered in `Asia/Manila` standard clinic time.
