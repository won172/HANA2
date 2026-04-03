# DESIGN.md

## Brand
- Product: Hana Campus Budget
- Brand Direction: 하나은행 협업형 캠퍼스 금융 서비스
- Keywords: trustworthy, financial, disciplined, calm, modern
- Avoid: 과한 오렌지/형광 포인트, 카드가 너무 많은 대시보드, 장난스러운 아이콘 남용, 다크 엔터프라이즈 느낌

## Color System
### Primary
- Primary: #00857A
- Primary-hover: #006B5D
- Primary-soft: #E8F7F4

### Neutral
- Background: #F4F8F7
- Surface: #FFFFFF
- Border: #D5E2DE
- Text-primary: #14332D
- Text-secondary: #60716C

### Sidebar
- Sidebar-bg: #0F3B34
- Sidebar-accent: #195147
- Sidebar-foreground: #EEF8F5
- Sidebar-primary: #00A18F

### Semantic
- Success: #198754
- Warning: #F59E0B
- Error: #DC2626
- Info: #0B63CE

## Typography
- Font family:
  - Korean: Pretendard
  - English: Inter
- Tone:
  - 제목은 금융 서비스처럼 단정하고 조밀하게
  - 본문은 설명형 문장보다 상태와 수치를 빠르게 읽히게
- H1: 32px / 700 / -0.025em
- H2: 24px / 700 / -0.02em
- H3: 18px / 600
- Body: 15px / 400 / 1.6
- Caption: 12px / 500 / 1.45
- Button: 15px / 600

## Spacing Scale
- 4, 8, 12, 16, 24, 32, 40, 48
- Default page padding: 24px
- Card padding: 20px
- Section gap: 24px
- Form field gap: 12px

## Radius
- Small: 10px
- Medium: 14px
- Large: 18px
- Pill: 999px

## Shadow
- Card: 0 8px 24px rgba(20, 51, 45, 0.05)
- Sidebar / shell: inset 0 1px 0 rgba(255,255,255,0.04)
- Modal: 0 18px 40px rgba(20, 51, 45, 0.14)

## Layout Rules
- Prefer desktop-first responsive layout
- Use a stable app shell with dark sidebar and light content canvas
- Max content width: 1200px
- Sidebar width: 280px
- Mobile uses single-column layout
- Sidebar items should be grouped by task, not listed as one long flat menu

## Component Rules
### Sidebar
- Dark green panel
- Section label + 2~3 relevant menus씩 그룹화
- Use line icons, not emoji
- Active item uses filled accent panel, not loud border-only treatment
- Demo tools belong in the lowest section

### Buttons
- Primary button: solid primary background, white text
- Secondary button: white background, 1px border
- Height: 44px
- Horizontal padding: 16px
- Radius: 12px

### Cards
- White surface
- Border: 1px solid #D5E2DE
- Radius: 16px
- Padding: 20px

### Inputs
- Height: 44px
- Border: 1px solid #C7D7D2
- Focus border: Primary
- Placeholder color: Text-secondary

## Interaction Rules
- Hover states should be subtle and financial-app-like
- Focus states must be clearly visible
- Avoid excessive motion
- Use short 150ms ease transitions

## Accessibility
- Minimum contrast: WCAG AA target
- Body text should not be below 14px
- Click targets minimum 44x44

## Product-Specific UI Guidance
- 관리자 화면은 "많이 보여주기"보다 "빨리 판단하게 하기"에 집중
- 강조색은 초록 계열을 기본으로 사용하고, 경고/오류는 의미가 있을 때만 사용
- 배지, 카드, 박스가 많아질수록 색보다 위계와 간격으로 정리
- POS, 데모, 감사 기능은 핵심 운영 메뉴보다 한 단계 아래로 보여주기
