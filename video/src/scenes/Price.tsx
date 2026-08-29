import React from "react";
import { Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { windowsXpError } from "@remotion/sfx";
import { Btn, C, Cursor, Screen, Win } from "../win95";
import { DeskIcons, DeskTaskbar } from "./desk";

const ITEMS: [string, string][] = [
  ["Vibe95 Professional Edition", "$0.00"],
  ["Unlimited AI code generation", "$0.00"],
  ["Multiplayer chat rooms", "$0.00"],
  ["That Pong game you just made", "$0.00"],
  ["Priority support (there is none)", "$0.00"],
];

const StopIcon: React.FC = () => (
  <div
    style={{
      width: 26,
      height: 26,
      borderRadius: "50%",
      backgroundColor: C.red,
      border: "1px solid #000",
      color: C.hi,
      fontSize: 19,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      lineHeight: "19px",
    }}
  >
    x
  </div>
);

const ErrorDialog: React.FC<{
  x: number;
  y: number;
  message: string;
}> = ({ x, y, message }) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 5], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.25, 0.4, 1),
  });
  return (
    <Win
      title="Vibe95"
      x={x}
      y={y}
      w={286}
      h={104}
      style={{ scale: String(s) }}
      buttons={false}
      icon={
        <div
          style={{
            width: 13,
            height: 13,
            borderRadius: "50%",
            backgroundColor: C.red,
            border: "1px solid #000",
          }}
        />
      }
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "6px 10px",
          fontSize: 12,
        }}
      >
        <StopIcon />
        <div style={{ lineHeight: "16px" }}>{message}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 6 }}>
        <Btn style={{ minWidth: 70 }}>OK</Btn>
      </div>
    </Win>
  );
};

export const Price: React.FC = () => {
  const frame = useCurrentFrame();

  const shown = Math.max(0, Math.floor((frame - 8) / 6));
  const totalIn = interpolate(frame, [44, 50], [2.2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.2, 0.4, 1),
  });
  const clicking = frame >= 58 && frame < 64;

  const cursorX = interpolate(frame, [46, 58], [330, 268], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.2, 1),
  });
  const cursorY = interpolate(frame, [46, 58], [140, 236], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.5, 0, 0.2, 1),
  });

  return (
    <Screen>
      <DeskIcons />
      <DeskTaskbar tasks={[{ label: "Vibe Studio" }, { label: "PONG.EXE" }]} />

      <Win
        title="Vibe95 Setup - Order Summary"
        x={112}
        y={38}
        w={416}
        h={214}
        style={{
          scale: String(
            interpolate(frame, [0, 7], [0.6, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.2, 1.1, 0.35, 1),
            }),
          ),
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
          }}
        >
          {ITEMS.map((it, i) => (
            <div
              key={it[0]}
              style={{
                display: "flex",
                gap: 8,
                opacity: i < shown ? 1 : 0,
              }}
            >
              <div>{it[0]}</div>
              <div
                style={{
                  flex: 1,
                  borderBottom: `1px dotted ${C.shadow}`,
                  marginBottom: 3,
                }}
              />
              <div style={{ fontWeight: 700 }}>{it[1]}</div>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              borderTop: `2px solid ${C.shadow}`,
              paddingTop: 6,
              opacity: frame >= 44 ? 1 : 0,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>TOTAL DUE TODAY</div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: C.navy,
                scale: String(totalIn),
              }}
            >
              $0.00
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            paddingBottom: 4,
            paddingRight: 6,
          }}
        >
          <Btn wide pressed={clicking}>
            Pay Now
          </Btn>
          <Btn>Cancel</Btn>
        </div>
      </Win>

      <Sequence from={64} name="Error 1" layout="none">
        <ErrorDialog x={60} y={58} message="Payment failed. There is nothing to pay for." />
        <Audio src={windowsXpError} volume={0.7} />
      </Sequence>
      <Sequence from={82} name="Error 2" layout="none">
        <ErrorDialog x={122} y={116} message="Billing subsystem not installed." />
        <Audio src={windowsXpError} volume={0.7} />
      </Sequence>
      <Sequence from={100} name="Error 3" layout="none">
        <ErrorDialog x={184} y={174} message="Please stop trying to give us money." />
        <Audio src={windowsXpError} volume={0.7} />
      </Sequence>

      <Cursor x={cursorX} y={cursorY} />
    </Screen>
  );
};
