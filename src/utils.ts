import {com, org} from "konform";
import SampleRange = com.vg.audio.SampleRange;
import {Long} from "kotlin";
import ChannelLabel = org.jcodec.common.model.ChannelLabel;

export const live4red = "#ee2737";
export const live4blue = "#2196f3";
export const ZERO = Long.fromInt(0);

export const DEFAULT_COLOR = "#475164";

export const WAVECOLORS = [
    "#475164"
    , "#E17d9f"
    , "#C1364E"
    , "#C1361E"
    , "#bb5f00"
    , "#F1A000"
    , "#ae8900"
    , "#83941d"
    , "#51Cd2f"
    , "#089a8c"
    , "#0078bb"
    , "#2060EA"
    , "#2d50a0"
    , "#6049ab",
];

export function newSampleRange(start: number, end: number): SampleRange {
    return new SampleRange(Long.fromNumber(start), Long.fromNumber(end));
}

export function fileKey(file: File): string {
    return (file as any).webkitRelativePath || file.name;
}

export function labelFromString(name: string) {
    switch (name) {
        case "MONO":
            return ChannelLabel.MONO;
        case "STEREO_LEFT":
            return ChannelLabel.STEREO_LEFT;
        case "STEREO_RIGHT":
            return ChannelLabel.STEREO_RIGHT;
        case "LEFT_TOTAL":
            return ChannelLabel.LEFT_TOTAL;
        case "RIGHT_TOTAL":
            return ChannelLabel.RIGHT_TOTAL;
        case "FRONT_LEFT":
            return ChannelLabel.FRONT_LEFT;
        case "FRONT_RIGHT":
            return ChannelLabel.FRONT_RIGHT;
        case "CENTER":
            return ChannelLabel.CENTER;
        case "LFE":
            return ChannelLabel.LFE;
        case "REAR_LEFT":
            return ChannelLabel.REAR_LEFT;
        case "REAR_RIGHT":
            return ChannelLabel.REAR_RIGHT;
        case "FRONT_CENTER_LEFT":
            return ChannelLabel.FRONT_CENTER_LEFT;
        case "FRONT_CENTER_RIGHT":
            return ChannelLabel.FRONT_CENTER_RIGHT;
        case "REAR_CENTER":
            return ChannelLabel.REAR_CENTER;
        case "SIDE_LEFT":
            return ChannelLabel.SIDE_LEFT;
        case "SIDE_RIGHT":
            return ChannelLabel.SIDE_RIGHT;
    }
}
