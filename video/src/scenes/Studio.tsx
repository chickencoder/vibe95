import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import {
  Btn,
  C,
  Cursor,
  ExeIcon,
  ProgressBlocks,
  Screen,
  Sunken,
  Win,
} from "../win95";
import { DeskIcons, DeskTaskbar } from "./desk";

const PROMPT = "make me a pong game but the ball is a smiley face";
const TYPE_START = 14;
const TYPE_END = 56;
const CLICK = 62;
const GEN_START = 66;

const STEPS = [
  { label: "Contacting the AI", at: 0, done: 12 },
  { label: "Thinking it through", at: 12, done: 68 },
  { label: "Writing the code", at: 68, done: 94 },
  { label: "Testing the program", at: 94, done: 112 },
];

const QUIPS = [
  "It plans before it writes. At length.",
  "Still thinking. It is free, be nice.",
  "It has thought about this more than you have.",
  "Almost. Probably. Free models are like that.",
];

export const Studio: React.FC = () => {
  const frame = useCurrentFrame();

  const open = interpolate(frame, [0, 8], [0.55, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.1, 0.35, 1),
  });

  const typed = Math.floor(
    interpolate(frame, [TYPE_START, TYPE_END], [0, PROMPT.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const g = frame - GEN_START;
  const generating = g >= 0;

  const cursorX = interpolate(frame, [8, 16, 56, 62], [300, 190, 190, 466], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.2, 1),
  });
  const cursorY = interpolate(frame, [8, 16, 56, 62], [200, 254, 254, 254], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.2, 1),
  });

  const chars = Math.floor(
    interpolate(g, [12, 68], [0, 61840], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const codeChars = Math.floor(
    interpolate(g, [68, 94], [0, 7412], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const quip = QUIPS[Math.min(QUIPS.length - 1, Math.floor(Math.max(g - 14, 0) / 16))];
  const dots = ".".repeat((Math.floor(frame / 5) % 3) + 1);

  return (
    <Screen>
      <DeskIcons />
      <DeskTaskbar tasks={[{ label: "Vibe Studio", active: true }]} />

      <Win
        title="Vibe Studio"
        x={78}
        y={34}
        w={484}
        h={252}
        menu={["File", "Edit", "View", "Help"]}
        icon={<ExeIcon size={13} />}
        style={{ scale: String(open) }}
      >
        <Sunken style={{ flex: 1, backgroundColor: C.hi, padding: 6 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {typed > 0 ? (
              <div style={{ color: C.navy, fontWeight: 700 }}>
                &gt; {PROMPT.slice(0, typed)}
              </div>
            ) : null}

            {generating ? (
              <div
                style={{
                  border: `1px solid ${C.shadow}`,
                  backgroundColor: C.face,
                  padding: 7,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                {STEPS.map((s) => {
                  const active = g >= s.at && g < s.done;
                  const done = g >= s.done;
                  return (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        opacity: done || active ? 1 : 0.42,
                        fontWeight: active ? 700 : 400,
                      }}
                    >
                      <div
                        style={{
                          width: 11,
                          textAlign: "center",
                          color: done ? C.green : C.dark,
                        }}
                      >
                        {done ? "✓" : active ? "▶" : "·"}
                      </div>
                      <div>
                        {s.label}
                        {active ? dots : ""}
                      </div>
                      <div style={{ flex: 1 }} />
                      {s.label === "Thinking it through" && (active || done) ? (
                        <div style={{ color: C.shadow }}>
                          {chars.toLocaleString("en-US")} chars
                        </div>
                      ) : null}
                      {s.label === "Writing the code" && (active || done) ? (
                        <div style={{ color: C.shadow }}>
                          {codeChars.toLocaleString("en-US")} chars
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <ProgressBlocks
                  progress={interpolate(g, [0, 112], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })}
                  width={452}
                  height={16}
                />
                <div style={{ color: C.navy }}>{quip}</div>
              </div>
            ) : null}
          </div>
        </Sunken>

        <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
          <Sunken
            style={{
              flex: 1,
              height: 22,
              display: "flex",
              alignItems: "center",
              padding: "0 5px",
              backgroundColor: generating ? C.face : C.hi,
              color: generating ? C.shadow : C.dark,
            }}
          >
            {generating ? "" : PROMPT.slice(0, typed)}
            {!generating && Math.floor(frame / 6) % 2 === 0 ? (
              <span style={{ marginLeft: 1 }}>|</span>
            ) : null}
          </Sunken>
          <Btn wide pressed={frame >= CLICK && frame < CLICK + 5}>
            {generating ? "Stop" : "Generate"}
          </Btn>
        </div>
      </Win>

      <Cursor x={cursorX} y={cursorY} busy={generating} />
    </Screen>
  );
};
