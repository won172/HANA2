# DESIGN.md

## Brand
- Product: Dongguk University Student Assistant
- Keywords: trustworthy, academic, warm, clean
- Avoid: flashy gradients, overly playful illustrations, dark-heavy enterprise look

## Color System
### Primary
- Primary: #F58220
- Primary-hover: #E26F12
- Primary-soft: #FFF3E8

### Neutral
- Background: #F8F9FB
- Surface: #FFFFFF
- Border: #E5E7EB
- Text-primary: #111827
- Text-secondary: #6B7280

### Semantic
- Success: #16A34A
- Warning: #F59E0B
- Error: #DC2626
- Info: #2563EB

## Typography
- Font family:
  - Korean: Pretendard
  - English: Inter
- H1: 32px / 700 / -0.02em
- H2: 24px / 700 / -0.01em
- H3: 20px / 600
- Body: 16px / 400 / 1.6
- Caption: 13px / 400 / 1.5
- Button: 15px / 600

## Spacing Scale
- 4, 8, 12, 16, 24, 32, 40, 48
- Default page padding: 24px
- Card padding: 20px
- Section gap: 32px
- Form field gap: 12px

## Radius
- Small: 8px
- Medium: 12px
- Large: 16px
- Pill: 999px

## Shadow
- Card: 0 2px 8px rgba(17, 24, 39, 0.06)
- Modal: 0 8px 24px rgba(17, 24, 39, 0.12)

## Layout Rules
- Prefer desktop-first responsive layout
- Use 12-column grid on desktop
- Max content width: 1200px
- Sidebar width: 280px
- Mobile uses single-column layout

## Component Rules
### Buttons
- Primary button: solid primary background, white text
- Secondary button: white background, 1px border
- Height: 44px
- Horizontal padding: 16px
- Radius: 12px

### Cards
- White surface
- Border: 1px solid #E5E7EB
- Radius: 16px
- Padding: 20px

### Inputs
- Height: 44px
- Border: 1px solid #D1D5DB
- Focus border: Primary
- Placeholder color: Text-secondary

## Interaction Rules
- Hover states should be subtle
- Focus states must be clearly visible
- Avoid excessive motion
- Use quick fade or 150ms ease transitions

## Accessibility
- Minimum contrast: WCAG AA target
- Body text should not be below 14px
- Click targets minimum 44x44

## Product-Specific UI Guidance
- Chat UI should feel calm and service-oriented
- Admin screens should prioritize information density and clarity
- Use orange only for emphasis, not everywhere
- Important notices should use bordered info boxes, not loud alert banners