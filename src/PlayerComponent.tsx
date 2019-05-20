import {_private, Player} from "@sysval/vgplayer-core";
import {konform} from "konform";
import * as React from "react";
import {Mp3StereoSegmentedAudioStream, SilenceAudioStream} from "./Mp3SegmentedAudioSteam";
import {live4red} from "./utils";
import PlayerAudioTrack = _private.PlayerAudioTrack;
import StereoDownmixSource = konform.StereoDownmixSource;
import {Channel} from "./model";

export interface TimeSample {
    frame: number;
    sec: number;
    tv: number;
}

interface PlayerProps {
    url: string;
    timeUpdate?: (ts: TimeSample) => void;
    onCanPlay?: (videoEl: HTMLVideoElement) => void;
    onUrlLoaded?: (player: Player) => void;
    frame?: number;
    range?: { start: number, end: number };
    loop?: boolean;
    audioChannels?: Channel[];
}

interface PlayerState {
    playerLoaded: boolean;
}

export class PlayerComponent extends React.Component<PlayerProps, PlayerState> {

    public state: PlayerState = {
        playerLoaded: false,
    };
    protected player: Player;

    public componentWillReceiveProps(nextProps: Readonly<PlayerProps>, nextContext: any): void {
        if (!(this.player && this.state.playerLoaded)) {
            return;
        }
        if (nextProps.frame != this.props.frame) {
            this.player.seekFrame(nextProps.frame);
        }
        const nextchannels = nextProps.audioChannels || [];
        const curchannels = this.props.audioChannels || [];

        const newchannels = nextchannels.map((c) => `${c.label}:${c.sampleRateString()}:${c.id}`).join(",");
        const oldchannels = curchannels.map((c) => `${c.label}:${c.sampleRateString()}:${c.id}`).join(",");
        if (newchannels != oldchannels) {
            console.log("channels", newchannels, oldchannels);
            console.log("new audio files", nextProps.audioChannels);
            if (nextchannels.length == 0) {
                let track = this.player.getAudioTrack("noaudio");
                if (track == null) {
                    track = new PlayerAudioTrack("noaudio", this.player.getLog());
                    track.update(new SilenceAudioStream("noaudio", this.player.getDurationSec()));
                    this.player._addToAudioTracks(track);
                }
                this.player.setCurrentAudioTrack("noaudio");
                // this.player.applyAudioChanges();
            } else {
                let track = this.player.getAudioTrack("mp3downmix");
                const needNewTrack = track == null;
                if (needNewTrack && nextchannels.length != 0) {
                    track = new PlayerAudioTrack("mp3downmix", this.player.getLog());
                }
                const sources = nextchannels.map((c) => c.samples);
                const labels = nextchannels.map((c) => c.label);
                const downmix = new StereoDownmixSource(sources, labels);
                const channel = nextchannels[0];
                track.update(new Mp3StereoSegmentedAudioStream("mp3downmix", channel.audioInfo, downmix));
                if (needNewTrack) {
                    this.player._addToAudioTracks(track);
                }
                this.player.setCurrentAudioTrack("mp3downmix");
                // this.player.applyAudioChanges();
            }
        }
    }

    public render(): React.ReactNode {
        return <div ref={this.playerRef}/>;
    }

    private onTimeUpdate = (ts: TimeSample) => {
        if (this.props.timeUpdate) {
            this.props.timeUpdate(ts);
        }
    };

    private playerRef = (el: HTMLElement) => {
        if (!el) {
            this.player = null;
            return;
        }
        const {range, loop} = this.props;

        console.log("new Player", this.props.url);
        this.player = new Player(el, {hotkeys: true});
        (window as any).hackPlayer = this.player;
        this.player.load(this.props.url, (err) => {
            if (err) {
                return;
            }
            if (range) {
                this.player.setRange(range.start, range.end);
            }
            this.player.setLoop(false);
            this.player.addEventListener("timeupdate", this.onTimeUpdate);
            this.setState({playerLoaded: true});
            if (this.props.frame > 0) {
                this.player.seekFrame(this.props.frame);
            }
            if (this.props.onUrlLoaded) {
                this.props.onUrlLoaded(this.player);
            }
        });
    }
}

export class SeekablePlayerComponent extends PlayerComponent {
    private width = 1280;

    public render(): React.ReactNode {
        return <div style={{width: "100%", height: "720px"}} key="vplayer">
            {super.render()}
            <div key="seekbar" style={{width: "100%", height: "8px", background: "grey", position: "relative"}}
                 ref={r => {
                     if (r) {
                         this.width = r.clientWidth | 0;
                     }
                 }
                 }
                 onClick={(el) => {
                     const offsetX = el.nativeEvent.offsetX;
                     const w = el.currentTarget.clientWidth;
                     const seeksec = offsetX * this.player.getDurationSec() / w;
                     console.log(offsetX, w, seeksec);
                     this.player.seekSec(seeksec);
                 }}>
                {this.buffered()}
                <div style={{
                    width: this.currentTimePx(),
                    height: "8px",
                    background: live4red,
                    position: "absolute",
                    opacity: 0.84,
                    pointerEvents: "none",
                }}/>
            </div>
        </div>;
    }

    private currentTimePx(): string {
        if (!this.player) {
            return "0px";
        }
        const t = this.player.getCurrentTime();
        const d = this.player.getDurationSec();
        const p = t / d * this.width;
        return `${p}px`;
    }

    private px(t: number): number {
        if (!this.player) {
            return 0;
        }
        const d = this.player.getDurationSec();
        const p = t / d * this.width;
        return p;
    }

    private buffered(): React.ReactNode[] {
        if (!this.player) {
            return [];
        }
        return this.player.getBuffered().map((tr) => {
            const s = tr.start;
            const d = tr.end - tr.start;
            const left = this.px(s);
            const width = this.px(d);
            return <div style={{
                left: `${left}px`,
                width: `${width}px`,
                height: "8px",
                background: "#d2d2d2",
                position: "absolute",
                pointerEvents: "none",
            }}/>;

        });
    }
}
