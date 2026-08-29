import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";

export const C = {
  face: "#c0c0c0",
  hi: "#ffffff",
  light: "#dfdfdf",
  shadow: "#808080",
  dark: "#000000",
  desktop: "#008080",
  navy: "#000080",
  blue2: "#1084d0",
  inactive: "#808080",
  inactive2: "#b5b5b5",
  yellow: "#ffff00",
  green: "#00a800",
  red: "#a80000",
};

export const W = 640;
export const H = 360;

export const bevelOut: React.CSSProperties = {
  border: "2px solid",
  borderColor: `${C.light} ${C.dark} ${C.dark} ${C.light}`,
  boxShadow: `inset 1px 1px 0 ${C.hi}, inset -1px -1px 0 ${C.shadow}`,
};

export const bevelIn: React.CSSProperties = {
  border: "2px solid",
  borderColor: `${C.shadow} ${C.hi} ${C.hi} ${C.shadow}`,
  boxShadow: `inset 1px 1px 0 ${C.dark}, inset -1px -1px 0 ${C.light}`,
};

export const bevelThin: React.CSSProperties = {
  border: "1px solid",
  borderColor: `${C.hi} ${C.shadow} ${C.shadow} ${C.hi}`,
};

let fontsLoaded = false;

export const useWin95Font = () => {
  const [handle] = useState(() => delayRender("ms-sans-serif"));
  useEffect(() => {
    if (fontsLoaded) {
      continueRender(handle);
      return;
    }
    Promise.all([
      new FontFace(
        "MSSansSerif",
        `url(${staticFile("fonts/ms_sans_serif.woff2")}) format("woff2")`,
        { weight: "400" },
      ).load(),
      new FontFace(
        "MSSansSerif",
        `url(${staticFile("fonts/ms_sans_serif_bold.woff2")}) format("woff2")`,
        { weight: "700" },
      ).load(),
    ])
      .then((faces) => {
        faces.forEach((f) => document.fonts.add(f));
        fontsLoaded = true;
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle]);
};

export const FONT = '"MSSansSerif", Tahoma, Geneva, sans-serif';

/**
 * The whole video is drawn on a 640x360 "virtual monitor" and scaled 3x to
 * 1920x1080. That way every measurement below can use authentic Windows 95
 * pixel values (18px title bars, 11px text) and still read at video size.
 */
export const Screen: React.FC<{
  children: React.ReactNode;
  bg?: string;
}> = ({ children, bg = C.desktop }) => {
  useWin95Font();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: W,
          height: H,
          scale: "3",
          position: "relative",
          overflow: "hidden",
          backgroundColor: bg,
          fontSize: 11,
          color: C.dark,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

export const TitleButton: React.FC<{ glyph: "min" | "max" | "close" }> = ({
  glyph,
}) => {
  return (
    <div
      style={{
        ...bevelOut,
        width: 16,
        height: 14,
        backgroundColor: C.face,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: glyph === "close" ? 2 : 0,
      }}
    >
      {glyph === "min" ? (
        <div
          style={{
            width: 6,
            height: 2,
            backgroundColor: C.dark,
            marginTop: 5,
          }}
        />
      ) : null}
      {glyph === "max" ? (
        <div
          style={{
            width: 8,
            height: 8,
            borderStyle: "solid",
            borderColor: C.dark,
            borderWidth: "2px 1px 1px 1px",
          }}
        />
      ) : null}
      {glyph === "close" ? (
        <div
          style={{
            fontFamily: FONT,
            fontSize: 9,
            fontWeight: 700,
            lineHeight: "9px",
          }}
        >
          x
        </div>
      ) : null}
    </div>
  );
};

export const Win: React.FC<{
  title: string;
  x: number;
  y: number;
  w: number;
  h?: number;
  active?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  buttons?: boolean;
  menu?: string[];
}> = ({
  title,
  x,
  y,
  w,
  h,
  active = true,
  icon,
  children,
  style,
  buttons = true,
  menu,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundColor: C.face,
        padding: 3,
        display: "flex",
        flexDirection: "column",
        ...bevelOut,
        ...style,
      }}
    >
      <div
        style={{
          height: 18,
          background: active
            ? `linear-gradient(90deg, ${C.navy} 0%, ${C.blue2} 100%)`
            : `linear-gradient(90deg, ${C.inactive} 0%, ${C.inactive2} 100%)`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 2,
          paddingRight: 2,
          gap: 3,
          flexShrink: 0,
        }}
      >
        {icon}
        <div
          style={{
            color: C.hi,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 0.2,
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {title}
        </div>
        {buttons ? (
          <div style={{ display: "flex" }}>
            <TitleButton glyph="min" />
            <TitleButton glyph="max" />
            <TitleButton glyph="close" />
          </div>
        ) : null}
      </div>
      {menu ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "2px 4px",
            flexShrink: 0,
          }}
        >
          {menu.map((m) => (
            <div key={m}>
              <span style={{ textDecoration: "underline" }}>{m[0]}</span>
              {m.slice(1)}
            </div>
          ))}
        </div>
      ) : null}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          marginTop: 2,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const Btn: React.FC<{
  children: React.ReactNode;
  pressed?: boolean;
  wide?: boolean;
  style?: React.CSSProperties;
}> = ({ children, pressed, wide, style }) => {
  return (
    <div
      style={{
        ...(pressed ? bevelIn : bevelOut),
        backgroundColor: C.face,
        minWidth: wide ? 90 : 60,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: pressed ? 2 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Sunken: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      ...bevelIn,
      backgroundColor: C.hi,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

export const StartFlag: React.FC<{ size?: number }> = ({ size = 14 }) => {
  const q = size / 2 - 0.5;
  const cells = [
    { c: "#ff3b30", x: 0, y: 0 },
    { c: "#00a4e4", x: 1, y: 0 },
    { c: "#7ac943", x: 0, y: 1 },
    { c: "#ffd400", x: 1, y: 1 },
  ];
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
      }}
    >
      {cells.map((cell, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cell.x * (q + 1),
            top: cell.y * (q + 1),
            width: q,
            height: q,
            backgroundColor: cell.c,
            transform: `skewY(${cell.y === 0 ? -12 : -12}deg)`,
          }}
        />
      ))}
    </div>
  );
};

export const Taskbar: React.FC<{
  tasks?: { label: string; active?: boolean }[];
  startPressed?: boolean;
  clock?: string;
  y?: number;
}> = ({ tasks = [], startPressed, clock = "11:59 PM", y = 0 }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: y,
        height: 28,
        backgroundColor: C.face,
        borderTop: `1px solid ${C.hi}`,
        display: "flex",
        alignItems: "center",
        padding: "2px 3px",
        gap: 4,
      }}
    >
      <div
        style={{
          ...(startPressed ? bevelIn : bevelOut),
          backgroundColor: C.face,
          height: 22,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 6px 0 4px",
          fontWeight: 700,
        }}
      >
        <StartFlag />
        Start
      </div>
      <div style={{ width: 3 }} />
      {tasks.map((t) => (
        <div
          key={t.label}
          style={{
            ...(t.active ? bevelIn : bevelOut),
            backgroundColor: C.face,
            height: 22,
            minWidth: 120,
            display: "flex",
            alignItems: "center",
            padding: "0 6px",
            fontWeight: t.active ? 700 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {t.label}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div
        style={{
          ...bevelIn,
          height: 22,
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
        }}
      >
        {clock}
      </div>
    </div>
  );
};

export const Cursor: React.FC<{
  x: number;
  y: number;
  busy?: boolean;
}> = ({ x, y, busy }) => {
  if (busy) {
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 12,
          height: 16,
          zIndex: 999,
        }}
      >
        <svg width="12" height="16" viewBox="0 0 12 16">
          <path
            d="M2 1h8v3l-3 4 3 4v3H2v-3l3-4-3-4z"
            fill="#ffffff"
            stroke="#000000"
            strokeWidth="1"
          />
          <path d="M4 3h4l-2 3z" fill="#000080" />
          <path d="M4 13h4l-2-3z" fill="#000080" />
        </svg>
      </div>
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 12,
        height: 18,
        zIndex: 999,
      }}
    >
      <svg width="12" height="18" viewBox="0 0 12 18">
        <path
          d="M0 0v13l3.2-3.2 2.1 5 2.6-1.1-2.1-4.9H10z"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

/** Classic defragmenter-style segmented progress bar. */
export const ProgressBlocks: React.FC<{
  progress: number;
  width: number;
  height?: number;
}> = ({ progress, width, height = 16 }) => {
  const total = Math.floor((width - 6) / 8);
  const filled = Math.round(total * Math.min(Math.max(progress, 0), 1));
  return (
    <div
      style={{
        ...bevelIn,
        width,
        height,
        backgroundColor: C.face,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 2,
      }}
    >
      {new Array(filled).fill(0).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: height - 8,
            backgroundColor: C.navy,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
};

/** A tiny 24x24 "program" icon that looks like a mini window. */
export const ExeIcon: React.FC<{ size?: number; hue?: string }> = ({
  size = 24,
  hue = C.navy,
}) => (
  <div
    style={{
      width: size,
      height: size,
      backgroundColor: C.face,
      border: `1px solid ${C.dark}`,
      boxShadow: `inset 1px 1px 0 ${C.hi}, inset -1px -1px 0 ${C.shadow}`,
      padding: 1,
      display: "flex",
      flexDirection: "column",
      gap: 1,
    }}
  >
    <div style={{ height: size / 5, backgroundColor: hue }} />
    <div style={{ height: 2, backgroundColor: C.shadow, width: "80%" }} />
    <div style={{ height: 2, backgroundColor: C.shadow, width: "60%" }} />
    <div style={{ height: 2, backgroundColor: C.shadow, width: "70%" }} />
  </div>
);

export const MyComputerIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <div style={{ width: size, height: size, position: "relative" }}>
    <div
      style={{
        position: "absolute",
        left: 2,
        top: 1,
        width: size - 4,
        height: size * 0.6,
        backgroundColor: C.face,
        border: `1px solid ${C.dark}`,
        padding: 2,
      }}
    >
      <div style={{ width: "100%", height: "100%", backgroundColor: C.desktop }} />
    </div>
    <div
      style={{
        position: "absolute",
        left: 1,
        top: size * 0.68,
        width: size - 2,
        height: size * 0.28,
        backgroundColor: C.face,
        border: `1px solid ${C.dark}`,
      }}
    />
  </div>
);

export const ChatIcon: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <div style={{ width: size, height: size, position: "relative" }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 2,
        width: size - 7,
        height: size - 12,
        backgroundColor: C.hi,
        border: `1px solid ${C.dark}`,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 6,
        top: 8,
        width: size - 7,
        height: size - 12,
        backgroundColor: C.yellow,
        border: `1px solid ${C.dark}`,
      }}
    />
  </div>
);

export const DesktopIcon: React.FC<{
  label: string;
  x: number;
  y: number;
  children: React.ReactNode;
  selected?: boolean;
  style?: React.CSSProperties;
}> = ({ label, x, y, children, selected, style }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 64,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 3,
      ...style,
    }}
  >
    {children}
    <div
      style={{
        color: C.hi,
        fontSize: 10,
        textAlign: "center",
        textShadow: "1px 1px 0 rgba(0,0,0,0.7)",
        backgroundColor: selected ? C.navy : "transparent",
        padding: "0 2px",
        lineHeight: "12px",
      }}
    >
      {label}
    </div>
  </div>
);
