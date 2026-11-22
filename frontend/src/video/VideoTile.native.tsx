import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { liveKitAvailable } from "./lk";

type Props = { track: any; mirror?: boolean; fit?: "cover" | "contain"; style?: StyleProp<ViewStyle> };

export function VideoTile({ track, mirror, fit = "cover", style }: Props) {
  if (!track || !liveKitAvailable()) return <View style={style} />;
  const { VideoView } = require("@livekit/react-native");
  return <VideoView videoTrack={track} mirror={mirror} objectFit={fit} style={style} />;
}
