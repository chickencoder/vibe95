import React from "react";
import { Composition } from "remotion";
import "./index.css";
import { Main } from "./Main";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Vibe95Launch"
      component={Main}
      durationInFrames={1090}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ url: "vibe95.net" }}
    />
  );
};
