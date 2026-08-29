import React from "react";
import {
  ChatIcon,
  DesktopIcon,
  ExeIcon,
  MyComputerIcon,
  Taskbar,
  C,
} from "../win95";

export const DeskIcons: React.FC<{
  reveal?: number;
  extra?: React.ReactNode;
}> = ({ reveal = 99, extra }) => {
  const icons = [
    {
      label: "My Computer",
      node: <MyComputerIcon size={28} />,
      x: 16,
      y: 14,
    },
    {
      label: "Vibe Studio",
      node: <ExeIcon size={26} hue={C.navy} />,
      x: 16,
      y: 74,
    },
    {
      label: "Vibe Chat",
      node: <ChatIcon size={26} />,
      x: 16,
      y: 134,
    },
  ];
  return (
    <>
      {icons.slice(0, reveal).map((ic) => (
        <DesktopIcon key={ic.label} label={ic.label} x={ic.x} y={ic.y}>
          {ic.node}
        </DesktopIcon>
      ))}
      {extra}
    </>
  );
};

export const DeskTaskbar: React.FC<{
  tasks?: { label: string; active?: boolean }[];
  y?: number;
  startPressed?: boolean;
}> = ({ tasks, y, startPressed }) => (
  <Taskbar tasks={tasks} y={y} startPressed={startPressed} clock="11:59 PM" />
);
