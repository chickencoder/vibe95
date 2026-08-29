import React from "react";
import { Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { C, Cursor, H, Screen, W } from "../win95";
import { DeskIcons, DeskTaskbar } from "./desk";

const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const slam = interpolate(frame, [0, 9], [3.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.15, 0.35, 1),
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        scale: String(slam),
        opacity: interpolate(frame, [0, 4], [0, 1], {
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div
        style={{
          fontSize: 62,
          fontWeight: 700,
          color: C.hi,
          letterSpacing: 1,
          textShadow: `4px 4px 0 ${C.navy}, 8px 8px 0 rgba(0,0,0,0.45)`,
        }}
      >
        VIBE95
      </div>
      <div
        style={{
          backgroundColor: C.navy,
          color: C.hi,
          fontSize: 15,
          fontWeight: 700,
          padding: "5px 14px",
          letterSpacing: 1,
          border: `2px solid ${C.hi}`,
        }}
      >
        VIBE CODING FOR WINDOWS 95
      </div>
    </div>
  );
};

export const DesktopReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const wipe = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const barY = interpolate(frame, [14, 24], [-28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const iconCount = Math.max(0, Math.floor((frame - 22) / 5));

  const dim = interpolate(frame, [46, 56], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Screen bg="#000000">
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H * wipe,
          backgroundColor: C.desktop,
        }}
      />
      <DeskIcons reveal={iconCount} />
      <DeskTaskbar y={barY} />
      {frame < 46 ? <Cursor x={196} y={128} /> : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#000000",
          opacity: dim,
        }}
      />
      <Sequence from={50} name="Logo" layout="none">
        <Logo />
      </Sequence>
    </Screen>
  );
};
