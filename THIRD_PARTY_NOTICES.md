# Third-party components

The following components were retrieved from the official React Bits repository on 2026-10-15:
https://github.com/DavidHDev/react-bits

- src/ts-default/Backgrounds/Aurora/Aurora.tsx (+ CSS)
- src/ts-default/Backgrounds/Orb/Orb.tsx (+ CSS)
- src/ts-default/Animations/StarBorder/StarBorder.tsx (+ CSS)
- src/ts-default/Animations/ClickSpark/ClickSpark.tsx
- src/ts-default/Animations/Magnet/Magnet.tsx
- src/ts-default/Components/SpotlightCard/SpotlightCard.tsx (+ CSS)
- src/ts-default/TextAnimations/CountUp/CountUp.tsx

Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0.
The complete upstream license is preserved in components/react-bits/LICENSE.md.
These components are integrated into this application, not offered for sale or redistribution as a component collection.

Local adaptations:
- ClickSpark: removed automatic pointerdown/click listener registration. The existing imperative ref API is called only after a generation has been accepted.
- Aurora and Orb: omitted explicit loseContext during effect cleanup, allowing React Strict Mode to reuse the canvas context on effect remount. GL programs and buffers are still deleted during cleanup.
- Wrappers in components/effects.tsx apply shared theme values and static fallbacks. Canvas effects are unmounted when movement is disabled or unsupported.

Motion for React: https://github.com/motiondivision/motion (MIT)
Lucide React icons: https://github.com/lucide-icons/lucide (ISC)
Next.js: https://github.com/vercel/next.js (MIT)
React: https://github.com/facebook/react (MIT)
Tailwind CSS: https://github.com/tailwindlabs/tailwindcss (MIT)

Original procedural SVG covers and synthesized audio in public/covers and public/audio are dedicated to the public domain under CC0 1.0.
