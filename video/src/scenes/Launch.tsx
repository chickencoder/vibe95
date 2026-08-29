import React from "react";
import { Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { C, Cursor, DesktopIcon, ExeIcon, Screen, Sunken, Win } from "../win95";
import { DeskIcons, DeskTaskbar } from "./desk";

const FIELD_W = 388;
const FIELD_H = 138;
const BALL = 24;
const TOP = 30;

const bounce = (t: number, span: number, size: number) => {
  const period = 2 * (span - size);
  const p = ((t % period) + period) % period;
  return p <= span - size ? p : period - p;
};

const Smiley: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill={C.yellow} stroke="#000" strokeWidth="1.5" />
    <circle cx="8.5" cy="9.5" r="1.8" fill="#000" />
    <circle cx="15.5" cy="9.5" r="1.8" fill="#000" />
    <path
      d="M6.5 14c1.6 3.2 9.4 3.2 11 0"
      fill="none"
      stroke="#000"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const Pong: React.FC = () => {
  const frame = useCurrentFrame();
  const bx = bounce(frame * 5.1 + 40, FIELD_W, BALL);
  const by = bounce(frame * 3.3 + 10, FIELD_H, BALL);
  const track = (lag: number) => {
    const y = bounce(frame * 3.3 + 10 - lag, FIELD_H, BALL) + BALL / 2 - 22;
    return TOP + Math.min(FIELD_H - 44, Math.max(0, y));
  };

  return (
    <Sunken
      style={{
        flex: 1,
        backgroundColor: "#000000",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 2,
          backgroundImage:
            "repeating-linear-gradient(to bottom, #ffffff 0 6px, transparent 6px 12px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 8,
          top: track(3),
          width: 6,
          height: 44,
          backgroundColor: C.hi,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 8,
          top: track(-3),
          width: 6,
          height: 44,
          backgroundColor: C.hi,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: bx,
          top: TOP + by,
          rotate: `${frame * 3}deg`,
        }}
      >
        <Smiley size={BALL} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 4,
          display: "flex",
          justifyContent: "center",
          gap: 60,
          color: C.hi,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <div>03</div>
        <div>02</div>
      </div>
    </Sunken>
  );
};

export const Launch: React.FC = () => {
  const frame = useCurrentFrame();

  const drop = interpolate(frame, [0, 10], [-40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.2, 0.4, 1),
  });

  const open = interpolate(frame, [24, 33], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.1, 0.35, 1),
  });

  const capY = interpolate(frame, [58, 68], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <Screen>
      <DeskIcons
        extra={
          <DesktopIcon
            label="PONG.EXE"
            x={16}
            y={194 + drop}
            selected={frame > 12 && frame < 26}
          >
            <ExeIcon size={26} hue={C.green} />
          </DesktopIcon>
        }
      />
      <DeskTaskbar
        tasks={
          frame >= 24
            ? [
                { label: "Vibe Studio" },
                { label: "PONG.EXE", active: true },
              ]
            : [{ label: "Vibe Studio", active: true }]
        }
      />

      {frame >= 24 ? (
        <Win
          title="PONG.EXE"
          x={118}
          y={40}
          w={404}
          h={216}
          icon={<ExeIcon size={13} hue={C.green} />}
          style={{ scale: String(open) }}
        >
          <Pong />
        </Win>
      ) : null}

      <Cursor x={110} y={216} />

      <Sequence from={58} name="Caption" layout="none">
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 44,
            display: "flex",
            justifyContent: "center",
            translate: `0px ${capY}px`,
          }}
        >
          <div
            style={{
              backgroundColor: C.navy,
              color: C.hi,
              border: `2px solid ${C.hi}`,
              fontSize: 20,
              fontWeight: 700,
              padding: "6px 16px",
              letterSpacing: 0.5,
              boxShadow: "5px 5px 0 rgba(0,0,0,0.45)",
            }}
          >
            YOU DESCRIBE IT. IT SHIPS AS AN .EXE.
          </div>
        </div>
      </Sequence>
    </Screen>
  );
};
