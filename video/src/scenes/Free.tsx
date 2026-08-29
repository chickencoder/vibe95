import React from "react";
import { Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { whip } from "@remotion/sfx";
import { C, Screen } from "../win95";

const CARDS: {
  bg: string;
  fg: string;
  head: string;
  sub?: string;
  size: number;
}[] = [
  {
    bg: C.navy,
    fg: "#ffffff",
    head: "100% FREE",
    sub: "* there is no asterisk",
    size: 90,
  },
  {
    bg: "#008080",
    fg: "#ffffff",
    head: "NO CARD.\nNO TRIAL.\nNO 'CONTACT SALES'.",
    size: 54,
  },
  {
    bg: "#c0c0c0",
    fg: "#000080",
    head: "POWERED BY\nFREE AI MODELS",
    sub: "which is why it thinks for four minutes",
    size: 50,
  },
  {
    bg: "#a80000",
    fg: "#ffff00",
    head: "FREE AS IN BEER.\nAND AS IN SHAREWARE CD\nFROM A CEREAL BOX.",
    size: 38,
  },
];

const Card: React.FC<{ card: (typeof CARDS)[number] }> = ({ card }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 7], [1.35, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: card.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "0 40px",
      }}
    >
      <div
        style={{
          fontSize: card.size,
          lineHeight: 1.06,
          fontWeight: 700,
          color: card.fg,
          textAlign: "center",
          whiteSpace: "pre-line",
          letterSpacing: 0.5,
          textShadow: "4px 4px 0 rgba(0,0,0,0.35)",
          scale: String(s),
        }}
      >
        {card.head}
      </div>
      {card.sub ? (
        <div
          style={{
            fontSize: 18,
            color: card.fg,
            opacity: interpolate(frame, [10, 18], [0, 0.85], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            textAlign: "center",
          }}
        >
          {card.sub}
        </div>
      ) : null}
    </div>
  );
};

export const Free: React.FC = () => {
  return (
    <Screen bg="#000000">
      {CARDS.map((card, i) => (
        <Sequence
          key={card.head}
          from={i * 55}
          durationInFrames={56}
          name={`Card ${i + 1}`}
          layout="none"
        >
          <Card card={card} />
          <Audio src={whip} volume={0.35} />
        </Sequence>
      ))}
    </Screen>
  );
};
