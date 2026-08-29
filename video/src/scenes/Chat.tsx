import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { C, ChatIcon, Screen, Sunken, Win } from "../win95";
import { DeskIcons, DeskTaskbar } from "./desk";

const LINES: { at: number; nick?: string; text: string; sys?: boolean }[] = [
  { at: 0, text: "Now talking in #lobby. 5 users here.", sys: true },
  { at: 12, nick: "clippy_fan", text: "just shipped a drum machine" },
  { at: 26, nick: "dialup_dan", text: "sick. what did that run you" },
  { at: 40, nick: "clippy_fan", text: "zero" },
  { at: 52, nick: "dialup_dan", text: "zero what" },
  { at: 64, nick: "clippy_fan", text: "dollars. zero dollars." },
  { at: 80, text: "dialup_dan has left the room", sys: true },
  { at: 92, nick: "clippy_fan", text: "he'll be back" },
];

const USERS = ["clippy_fan", "dialup_dan", "netscape_nat", "bonzi_buddy", "you"];

export const Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const open = interpolate(frame, [0, 8], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 1.1, 0.35, 1),
  });

  const visible = LINES.filter((l) => frame >= l.at);

  return (
    <Screen>
      <DeskIcons />
      <DeskTaskbar
        tasks={[{ label: "PONG.EXE" }, { label: "Vibe Chat - #lobby", active: true }]}
      />

      <Win
        title="Vibe Chat - #lobby"
        x={70}
        y={30}
        w={500}
        h={252}
        icon={<ChatIcon size={13} />}
        menu={["File", "Room", "Help"]}
        style={{ scale: String(open) }}
      >
        <div style={{ flex: 1, display: "flex", gap: 4, minHeight: 0 }}>
          <Sunken
            style={{
              flex: 1,
              backgroundColor: C.hi,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 4,
              fontSize: 13,
            }}
          >
            {visible.map((l) => (
              <div key={l.text} style={{ display: "flex", gap: 5 }}>
                {l.sys ? (
                  <div style={{ color: C.shadow }}>* {l.text}</div>
                ) : (
                  <>
                    <div style={{ color: C.navy, fontWeight: 700 }}>
                      &lt;{l.nick}&gt;
                    </div>
                    <div>{l.text}</div>
                  </>
                )}
              </div>
            ))}
          </Sunken>
          <Sunken
            style={{
              width: 104,
              backgroundColor: C.hi,
              padding: 5,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: 12,
            }}
          >
            {USERS.map((u) => (
              <div
                key={u}
                style={{
                  color: u === "dialup_dan" && frame >= 80 ? C.shadow : C.dark,
                  textDecoration:
                    u === "dialup_dan" && frame >= 80 ? "line-through" : "none",
                }}
              >
                @{u}
              </div>
            ))}
          </Sunken>
        </div>
      </Win>
    </Screen>
  );
};
