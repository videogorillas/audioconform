import {_private} from "@sysval/vgplayer-core";
import {konform, org} from "konform";
import ChannelLabel = org.jcodec.common.model.ChannelLabel;

import AudioInfo = _private.AudioInfo;

import MonoSource = konform.MonoSource;
import WaveformSource = konform.WaveformSource;

export class Channel {
    public id: string;
    public label: ChannelLabel;
    public audioInfo: AudioInfo;
    public samples: MonoSource;
    public waveforms: WaveformSource;
    public forceSampleRate?: number;
    public color?: string;

    public sampleRateString(): string {
        if (this.forceSampleRate) {
            return `${this.forceSampleRate} -> ${this.audioInfo.sampleRate}`;
        }
        return `${this.audioInfo.sampleRate}`;
    }
}

export class AudioComponent {
    public channels: Channel[] = [];
    public name: string = "";
    public color: string;
}
