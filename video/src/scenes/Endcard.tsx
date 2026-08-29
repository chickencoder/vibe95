import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Btn, C, Screen, StartFlag, Sunken } from "../win95";

export const Endcard: React.FC<{ url: string }> = ({ url }) => {
  const frame = useCurrentFrame();

  const logo = interpolate(frame, [0, 10], [2.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const badge = interpolate(frame, [14, 21], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.4, 0.4, 1),
  });

  const urlIn = interpolate(frame, [28, 36], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <Screen>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          paddingBottom: 30,
        }}
      >
        <div
          style={{
            fontSize: 78,
            fontWeight: 700,
            color: C.hi,
            letterSpacing: 1,
            textShadow: `5px 5px 0 ${C.navy}, 10px 10px 0 rgba(0,0,0,0.4)`,
            scale: String(logo),
          }}
        >
          VIBE95
        </div>

        <div
          style={{
            backgroundColor: C.yellow,
            color: "#000000",
            border: "2px solid #000000",
            fontSize: 26,
            fontWeight: 700,
            padding: "5px 18px",
            letterSpacing: 1,
            boxShadow: "5px 5px 0 rgba(0,0,0,0.4)",
            scale: String(badge),
            rotate: "-2deg",
          }}
        >
          100% FREE. FOREVER. WE CHECKED.
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            translate: `0px ${urlIn}px`,
            opacity: frame >= 28 ? 1 : 0,
          }}
        >
          <Sunken
            style={{
              backgroundColor: C.hi,
              padding: "6px 16px",
              fontSize: 24,
              fontWeight: 700,
              color: C.navy,
            }}
          >
            {url}
          </Sunken>
        </div>

        <div
          style={{
            fontSize: 14,
            color: C.hi,
            opacity: interpolate(frame, [44, 52], [0, 0.9], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          No credit card. We would not know what to do with one.
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 28,
          backgroundColor: C.face,
          borderTop: `1px solid ${C.hi}`,
          display: "flex",
          alignItems: "center",
          padding: "2px 3px",
          gap: 8,
        }}
      >
        <Btn
          pressed={Math.floor(frame / 15) % 2 === 1}
          style={{ minWidth: 0, height: 22, gap: 4 }}
        >
          <StartFlag />
          <span style={{ fontWeight: 700, marginLeft: 4 }}>Start</span>
        </Btn>
        <div style={{ fontWeight: 700 }}>Click Start to begin.</div>
      </div>
    </Screen>
  );
};
