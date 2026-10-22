/**
 * An authored, illustrative carton dieline for the landing page. The product is invented;
 * it exists only to show how PackProofAI reads panels. Cut lines are solid, folds are dashed.
 */
export const CARTON = { width: 430, height: 470 };

/** Where each example value sits on the flat carton, in the drawing's own units. */
export const SPOTS: Record<string, [number, number, number, number]> = {
  name: [92, 146, 238, 214],
  net: [88, 372, 206, 392],
  sodium: [254, 140, 310, 158],
  allergen: [254, 348, 310, 372],
};

// Scattered oat flakes across the foot of the front panel (fixed, so every render matches).
const OATS: [number, number, number][] = Array.from({ length: 36 }, (_, i) => {
  const col = i % 9;
  const row = Math.floor(i / 9);
  return [88 + col * 19 + (row % 2) * 8, 326 + row * 11, ((i * 47) % 70) - 35];
});

export function ExampleCarton({ className, viewBox, label }: { className?: string; viewBox?: string; label?: string }) {
  const ink = "#15182B";
  return (
    <svg
      viewBox={viewBox ?? `0 0 ${CARTON.width} ${CARTON.height}`}
      className={className}
      role="img"
      aria-label={label ?? "Flat dieline of an example cereal carton: side, front, side and back panels with top and bottom flaps"}
    >

      {/* Flaps (folds dashed, cuts solid) */}
      <g fill="#FFFFFF" stroke={ink} strokeWidth="1">
        <path d="M80 80 L80 42 Q80 28 94 28 L236 28 Q250 28 250 42 L250 80" />
        <path d="M20 80 L28 54 L72 54 L80 80" />
        <path d="M250 80 L258 54 L302 54 L310 80" />
        <path d="M80 400 L80 440 L250 440 L250 400" />
        <path d="M20 400 L30 424 L70 424 L80 400" />
        <path d="M250 400 L260 424 L300 424 L310 400" />
        <path d="M310 400 L310 432 L420 432 L420 400" />
      </g>

      {/* Panels */}
      <rect x="20" y="80" width="60" height="320" fill="#FFFFFF" stroke={ink} strokeWidth="1" />
      <rect x="80" y="80" width="170" height="320" fill="#F2B544" stroke={ink} strokeWidth="1" />
      <rect x="250" y="80" width="60" height="320" fill="#FFFFFF" stroke={ink} strokeWidth="1" />
      <rect x="310" y="80" width="110" height="320" fill="#FBEFD8" stroke={ink} strokeWidth="1" />
      <path d="M6 92 L20 86 L20 394 L6 388 Z" fill="#FFFFFF" stroke={ink} strokeWidth="1" />

      {/* Fold lines */}
      <g stroke={ink} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.55">
        <line x1="80" y1="80" x2="250" y2="80" />
        <line x1="80" y1="400" x2="250" y2="400" />
        <line x1="20" y1="80" x2="20" y2="400" />
        <line x1="80" y1="80" x2="80" y2="400" />
        <line x1="250" y1="80" x2="250" y2="400" />
        <line x1="310" y1="80" x2="310" y2="400" />
      </g>

      {/* Front panel artwork */}
      <g fill="#E39A2E" opacity="0.55">
        {OATS.map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="2.8" ry="1.3" transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
      <text x="96" y="122" fontSize="9" fontWeight="800" letterSpacing="2" fill={ink}>
        NORTHFIELD
      </text>
      <text x="94" y="176" fontSize="34" fontWeight="800" fill={ink} style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'wdth' 75" }}>
        Oat
      </text>
      <text x="94" y="208" fontSize="34" fontWeight="800" fill={ink} style={{ fontFamily: "var(--font-display)", fontVariationSettings: "'wdth' 75" }}>
        Clusters
      </text>
      <text x="96" y="230" fontSize="10.5" fontWeight="600" fill={ink}>
        Honey Almond
      </text>
      <circle cx="222" cy="126" r="21" fill="#FFFFFF" stroke={ink} strokeWidth="1" />
      <text x="222" y="124" fontSize="5" fontWeight="800" textAnchor="middle" fill={ink}>
        GOOD SOURCE
      </text>
      <text x="222" y="131" fontSize="5" fontWeight="800" textAnchor="middle" fill={ink}>
        OF FIBER
      </text>
      <ellipse cx="166" cy="300" rx="62" ry="14" fill="#FFFFFF" stroke={ink} strokeWidth="1" />
      <g fill="#A8641F">
        <circle cx="140" cy="294" r="9" />
        <circle cx="158" cy="288" r="10" />
        <circle cx="178" cy="292" r="9" />
        <circle cx="194" cy="297" r="7" />
      </g>
      <g fill="#FFF5DD" stroke="#A8641F" strokeWidth="0.8">
        <ellipse cx="150" cy="298" rx="7" ry="3.5" transform="rotate(-20 150 298)" />
        <ellipse cx="185" cy="300" rx="7" ry="3.5" transform="rotate(15 185 300)" />
      </g>
      <path d="M104 300 Q166 360 228 300" fill="#FFFFFF" stroke={ink} strokeWidth="1" />
      <text x="92" y="386" fontSize="8.5" fontWeight="700" fill={ink}>
        NET WT 12 OZ (340 g)
      </text>

      {/* Left side panel: ingredients */}
      <text x="27" y="98" fontSize="5.5" fontWeight="800" fill={ink}>
        INGREDIENTS
      </text>
      <g fill="#C9CDD6">
        {[106, 113, 120, 127, 134, 141, 148].map((y, i) => (
          <rect key={y} x="27" y={y} width={i % 3 === 2 ? 30 : 46} height="3" rx="1.5" />
        ))}
      </g>

      {/* Right side panel: nutrition facts and allergen statement */}
      <rect x="256" y="90" width="48" height="190" fill="#FFFFFF" stroke={ink} strokeWidth="0.8" />
      <text x="259" y="102" fontSize="6.6" fontWeight="900" fill={ink}>
        Nutrition
      </text>
      <text x="259" y="110" fontSize="6.6" fontWeight="900" fill={ink}>
        Facts
      </text>
      <rect x="259" y="114" width="42" height="3" fill={ink} />
      <g fontSize="4.2" fill={ink}>
        <text x="259" y="126">Calories 160</text>
        <text x="259" y="137">Total Fat 5g</text>
        <text x="259" y="152" fontWeight="800">Sodium 140mg 9%</text>
        <text x="259" y="166">Total Carb. 26g</text>
        <text x="259" y="177">Dietary Fiber 2g</text>
        <text x="259" y="188">Protein 4g</text>
      </g>
      <g fill="#DADDE4">
        {[196, 204, 212, 220, 228, 236].map((y) => (
          <rect key={y} x="259" y={y} width="42" height="2" />
        ))}
      </g>
      <text x="257" y="358" fontSize="5" fontWeight="900" fill={ink}>
        CONTAINS:
      </text>
      <text x="257" y="366" fontSize="5" fontWeight="700" fill={ink}>
        ALMONDS
      </text>

      {/* Back panel: barcode */}
      <g fill={ink}>
        {[0, 2, 3, 6, 8, 9, 12, 15, 16, 18, 21, 22, 24, 27, 28, 30, 33, 35, 36, 39].map((x) => (
          <rect key={x} x={336 + x * 1.6} y="338" width={x % 3 === 0 ? 1.6 : 0.9} height="34" />
        ))}
      </g>
      <text x="366" y="380" fontSize="5" textAnchor="middle" fill={ink}>
        0 41234 56789 1
      </text>
      <g fill="#E8D3AE">
        {[110, 118, 126, 134].map((y, i) => (
          <rect key={y} x="324" y={y} width={i === 3 ? 50 : 82} height="3.5" rx="1.75" />
        ))}
      </g>

      {/* Panel names, as PackProofAI reads them from the guide labels */}
      <g fontSize="7" fontWeight="700" fill="#555A6E">
        <text x="22" y="414">Side</text>
        <text x="84" y="414">Front</text>
        <text x="252" y="414">Side</text>
        <text x="314" y="414">Back</text>
      </g>
    </svg>
  );
}
