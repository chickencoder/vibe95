import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { H, Screen, W } from "../win95";

const LINES: { text: string; delay: number; tail?: string; tailColor?: string }[] =
  [
    { text: "Vibe95 BIOS v0.95   (C) 1995 Landing Systems", delay: 1 },
    { text: "Detecting CPU ...................", delay: 7, tail: "OK" },
    { text: "Detecting AI models .............", delay: 13, tail: "OK" },
    {
      text: "Detecting billing system ........",
      delay: 19,
      tail: "NOT FOUND",
      tailColor: "#ff5555",
    },
    {
      text: "Detecting credit card reader ....",
      delay: 25,
      tail: "NOT FOUND",
      tailColor: "#ff5555",
    },
    { text: "Detecting free tier .............", delay: 31, tail: "IT IS ALL FREE TIER" },
    { text: "Proceeding anyway.", delay: 38 },
    { text: "Starting Vibe95 ...", delay: 45 },
  ];

const CHARS_PER_FRAME = 5.6;

export const Boot: React.FC = () => {
  const frame = useCurrentFrame();

  const flash = interpolate(frame, [52, 56, 60], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Screen bg="#000000">
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "26px 24px",
          fontFamily: '"Courier New", monospace',
          fontSize: 15,
          lineHeight: "22px",
          color: "#c8c8c8",
        }}
      >
        {LINES.map((line) => {
          const shown = Math.floor((frame - line.delay) * CHARS_PER_FRAME);
          if (shown <= 0) {
            return <div key={line.text} style={{ height: 22 }} />;
          }
          const full = line.text + (line.tail ? " " + line.tail : "");
          const visible = full.slice(0, shown);
          const bodyLen = Math.min(visible.length, line.text.length);
          return (
            <div key={line.text} style={{ height: 22, whiteSpace: "pre" }}>
              {visible.slice(0, bodyLen)}
              <span style={{ color: line.tailColor ?? "#55ff55" }}>
                {visible.slice(bodyLen)}
              </span>
            </div>
          );
        })}
        <div
          style={{
            width: 9,
            height: 16,
            backgroundColor: "#c8c8c8",
            marginTop: 4,
            opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0,
          }}
        />
      </div>

      {/* CRT scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1px, transparent 1px, transparent 3px)",
          opacity: 0.55,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "#ffffff",
          opacity: flash,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          backgroundColor: "#000000",
          opacity: interpolate(frame, [48, 56], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.6, 0, 1, 1),
          }),
        }}
      />
    </Screen>
  );
};
