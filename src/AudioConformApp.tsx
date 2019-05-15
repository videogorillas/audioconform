import Button from "@material-ui/core/Button";
import Checkbox from "@material-ui/core/Checkbox";
import IconButton from "@material-ui/core/IconButton";
import MoreVert from "@material-ui/icons/MoreVert";
import StarBorder from "@material-ui/icons/StarBorder";
import StarRate from "@material-ui/icons/StarRate";
import {_private, Player} from "@sysval/vgplayer-core";
import {com, konform, org} from "konform";
import {kotlin, Long} from "kotlin";
import * as React from "react";
import Dropzone from "react-dropzone";
import {Channel, SeekablePlayerComponent} from "./PlayerComponent";
import {fileKey, newSampleRange} from "./utils";
import WaveCanvas from "./WaveCanvas";
import ChannelLabel = org.jcodec.common.model.ChannelLabel;
import Observable = Rx.Observable;
import wavHeader = konform.wavHeader;
import Pair = kotlin.Pair;
import AudioInfo = _private.AudioInfo;
import WavHeader = org.jcodec.codecs.wav.WavHeader;
import WavSource = konform.WavSource;
import ResampleFilter = konform.ResampleFilter;
import FastAudioIndex = com.vg.audio.FastAudioIndex;
import SampleRange = com.vg.audio.SampleRange;
import WaveformSourceImpl = konform.WaveformSourceImpl;
import {workers} from "cluster";
import {indexWithWorker} from "./workerclient";

const styles = (theme: any) => ({
    button: {
        margin: theme.spacing.unit,
    },
    input: {
        display: "none",
    },
});

class AudioComponent {
    public files: File[] = [];
    public name: string = "";
}

interface AudioConformState {
    vfile: File;
    components: AudioComponent[];
    masterAudio: File;
    soloed: Set<File>;
    labelmap: Map<string, ChannelLabel>;
    vtime: number;
    settingsForComponent?: string;
    checkedForConform: Set<string>;
    forceSampleRate: Map<string, number>;
    indexProgress: Map<string, Long>;
    foundOffsets: Map<string, Long>;
}

interface AudioConformProps {
    workers: Worker[];
}

function audioInfoFromWav(wav: WavHeader) {
    const ai = new AudioInfo();
    ai.totalSamples = wav.getSampleCount().toNumber();
    ai.sampleRate = wav.getSampleRate();
    ai.channelCount = wav.channelLabels.length;
    ai.channelLabels = wav.channelLabels.map((c) => c.toString());
    ai.audioType = "wav";
    return ai;
}

const ZERO = Long.fromInt(0);

function labelFromString(name: string) {
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

export default class AudioConformApp extends React.Component<AudioConformProps, AudioConformState> {
    public state: AudioConformState = {
        vfile: null,
        components: [],
        masterAudio: null,
        soloed: new Set<File>(),
        labelmap: new Map<string, ChannelLabel>(),
        vtime: 0,
        indexProgress: new Map<string, Long>(),
        checkedForConform: new Set<string>(), // string -> boolean
        forceSampleRate: new Map<string, number>(), // string -> int
        foundOffsets: new Map<string, Long>(),
    };

    private channels = new Map<string, Channel>();
    private url: string = null;
    private player: Player = null;

    public componentWillUpdate(nextProps: Readonly<AudioConformProps>, nextState: Readonly<AudioConformState>, nextContext: any): void {
        if (this.state.vfile != nextState.vfile) {
            if (this.url != null) {
                URL.revokeObjectURL(this.url);
            }
            this.url = URL.createObjectURL(nextState.vfile);
            console.log(fileKey(nextState.vfile), this.url);
        }
    }

    public render(): React.ReactNode {
        // console.log("render", this);
        return <div key="wrapper-div">
            {this.videodrop()}
            {this.conformbutton()}
            {this.audio()}
            {this.audiodrop()}
            {this.audiodropFolder()}
        </div>;
    }

    private indexChannel(c: Channel): Observable<FastAudioIndex> {
        return konform.indexFromMonoSource(c.samples, c.audioInfo.sampleRate, (e: Long) => {
            const before = (this.state.indexProgress.get(c.id) || ZERO).toNumber();
            const updated = e.toNumber();
            if (updated - before > 5 * 48000) {
                console.log("index", c.id, e.toNumber());
                this.state.indexProgress.set(c.id, e);
                this.setState({indexProgress: this.state.indexProgress});
            }
        }).doOnNext((x) => {
            console.log("done index", c.id);
            this.state.indexProgress.set(c.id, ZERO);
            this.setState({indexProgress: this.state.indexProgress});
        });
    }

    private theconform() {
        const mc = this.makeChannelFromFile(this.state.masterAudio);
        const ccs = this.audioForConform().map((f) => this.makeChannelFromFile(f));

        const mi = this.indexChannel(mc);
        const cis = Observable.fromArray(ccs).concatMap((c) => {
            return this.indexChannel(c).map((cidx) => new Pair(c.id, cidx));
        });
        mi.subscribe((idx: FastAudioIndex) => {
            let workernum = 0;
            cis.flatMap(cidx => {
                workernum = workernum % this.props.workers.length;
                const wid = workernum;
                workernum++;
                const id = cidx.first;
                console.log("cidx", cidx);
                return indexWithWorker(this.props.workers[wid], idx, cidx.second).map(r => new Pair(id, r.best));
            }).subscribe((r) => {
                this.state.foundOffsets.set(r.first, Long.fromNumber(r.second));
                this.setState({foundOffsets: this.state.foundOffsets});
            }, (err: any) => console.log("cidx err", err));
        }, (err: any) => console.log("idx err", err));
    }

    private conformbutton() {
        const enabled = this.state.vfile != null && this.state.masterAudio != null && this.audioForConform().length != 0;
        return <Button variant="contained" color="primary" disabled={!enabled} onClick={(e) => this.theconform()}>
            Conform
        </Button>;
    }

    private audioForConform(): File[] {
        return this.audioFiles().filter((f) => this.state.checkedForConform.has(fileKey(f)));
    }

    private videodrop(): React.ReactNode {
        if (this.state.vfile == null) {
            return <Dropzone key="videodrop" onDrop={(acceptedFiles) => {
                console.log(acceptedFiles, this);
                this.setState({vfile: acceptedFiles[0]});
            }
            }>
                {({getRootProps, getInputProps}) => (
                    <section>
                        <div {...getRootProps()} style={{width: "1280px", height: "720px", background: "grey"}}>
                            <input {...getInputProps()} accept="video/*"/>
                            <p>Drag 'n' drop video here</p>
                        </div>
                    </section>
                )}
            </Dropzone>;
        } else {
            const audioChannels = this.audioFiles().filter((f) => this.state.soloed.has(f)).map((f) => this.makeChannelFromFile(f)).filter((c) => c != null);
            return <SeekablePlayerComponent
                key="vplayer" url={this.url}
                timeUpdate={(ts) => this.setState({vtime: ts.sec})}
                audioChannels={audioChannels}
                loop={true} onUrlLoaded={(player) => {
                this.player = player;
            }}/>;
        }
    }

    private audioFiles(): File[] {
        return this.state.components.flatMap((c) => c.files);
    }

    private makeChannelFromFile(file: File): Channel {
        const key = fileKey(file);
        const label = this.state.labelmap.get(key) || ChannelLabel.MONO;
        const forceSampleRate = this.state.forceSampleRate.get(key);
        const channel = this.channels.get(key);
        return this.makeChannel(forceSampleRate, label, channel);
    }

    private makeChannel(forceSampleRate: number, label: ChannelLabel, orig: Channel): Channel {
        const channel = orig;
        const c = new Channel();
        c.label = label;
        c.samples = channel.samples;
        if (forceSampleRate) {
            c.samples = new ResampleFilter(channel.samples, forceSampleRate, channel.audioInfo.sampleRate);
            c.forceSampleRate = forceSampleRate;
        }
        c.audioInfo = channel.audioInfo;
        c.id = channel.id;
        return c;
    }

    private star(isMaster: boolean): React.ReactNode {
        if (isMaster) {
            return <StarRate/>;
        }
        return <StarBorder/>;
    }

    private audiochannel(file: File): React.ReactNode {
        let endsec: number;
        if (this.player) {
            endsec = this.player.getDurationSec();
        }
        const isMaster = file == this.state.masterAudio;
        const key = fileKey(file);
        const channel = this.channels.get(key);
        const hz = this.state.forceSampleRate.get(key) || channel.audioInfo.sampleRate;
        // console.log(key, hz, this.state);
        const selectionEnd = this.state.indexProgress.get(key);
        const selectionRange: SampleRange = selectionEnd ? new SampleRange(ZERO, selectionEnd) : undefined;
        const offset = (this.state.foundOffsets.get(key) || ZERO).toNumber();
        const sampleRange = offset ? newSampleRange(-offset, endsec * channel.audioInfo.sampleRate - offset) : undefined;
        const offsetString = offset ? `${-offset}` : "";

        return <div key={key} style={{width: "1280px", height: "80px", position: "relative"}}>
            <div style={{position: "absolute", left: "0px"}}>
                <WaveCanvas key={`wave-${key}`} channel={channel}
                            startSec={0} endSec={endsec} sampleRange={sampleRange} selectRange={selectionRange}/></div>
            <div style={{position: "absolute"}} onClick={(e) => {
                const newhz = hz == 48000 ? 47952 : 48000;
                this.state.forceSampleRate.set(key, newhz);
                this.setState({forceSampleRate: this.state.forceSampleRate});
            }}>{key} {hz}Hz {offsetString}
            </div>
            <IconButton key={`makemaster-${key}`} onClick={(it) => {
                this.setState({masterAudio: file});
            }}>{this.star(isMaster)}</IconButton>
            {this.labelselect(file)}
            {this.solounsolo(file)}
            {this.hascheckbox(isMaster, key)}
            {/*<CircularProgress color="secondary"/>*/}
        </div>;
    }

    private hascheckbox(isMaster: boolean, key: string): React.ReactNode {
        if (isMaster) {
            return null;
        }
        return <Checkbox
            checked={this.state.checkedForConform.has(key)}
            onChange={(e) => {
                if (this.state.checkedForConform.has(key)) {
                    this.state.checkedForConform.delete(key);
                } else {
                    this.state.checkedForConform.add(key);
                }
                this.setState({checkedForConform: this.state.checkedForConform});
            }}
            value="checkedA"
        />;
    }

    private audio(): React.ReactNode[] {
        const comps: React.ReactNode[] = this.state.components.map((comp) => {
            return <div key={comp.name} style={{
                border: "1px",
                borderStyle: "dashed",
                borderColor: "darkgreen",
                width: "1280px",
                marginTop: "10px",
            }}><IconButton aria-label="More" onClick={(it) => this.setState({settingsForComponent: comp.name})}>
                <MoreVert/>
            </IconButton>

                {comp.files.map((file) => this.audiochannel(file))}
            </div>;
        });
        if (this.state.masterAudio) {
            comps.unshift(<div style={{
                border: "1px",
                borderStyle: "dashed",
                borderColor: "darkgreen",
                width: "1280px",
                marginTop: "10px",
            }}>{this.audiochannel(this.state.masterAudio)}</div>);
        }
        return comps;
    }

    private solounsolo(file: File) {
        const isSoloed = this.state.soloed.has(file);
        const solo = isSoloed ? "" : "md-inactive";
        const key = fileKey(file);
        return <label key={`solounsolo-${key}`}
                      style={{position: "absolute", paddingTop: "20px", right: "20px"}}
                      className={`material-icons md-dark ${solo}`}
                      onClick={() => {
                          if (isSoloed) {
                              this.state.soloed.delete(file);
                          } else {
                              this.state.soloed.add(file);
                          }
                          this.setState({soloed: this.state.soloed});
                      }}>hearing</label>;
    }

    private labelselect(file: File) {
        const key = fileKey(file);
        const currentLabel = this.state.labelmap.get(key) || ChannelLabel.MONO;

        return <select key={`soloselect-${key}`}
                       style={{position: "absolute", paddingTop: "20px", right: "20px"}} onChange={(it) => {
            console.log("labelselect", it.target.value);
            const label = labelFromString(it.target.value) || ChannelLabel.MONO;
            const lm = this.state.labelmap;
            lm.set(key, label);
            const c = this.channels.get(key);
            if (c != null) {
                c.label = label;
            }
            this.setState({labelmap: lm});
        }}>
            {
                ChannelLabel.values().map((label) => {
                    const selected = label == currentLabel;
                    return <option value={`${label}`} selected={selected}>{`${label}`}</option>;
                })
            }
        </select>;
    }

    private onDropAudio(acceptedFiles: File[]): void {
        console.log(acceptedFiles);
        const afiles: File[] = this.audioFiles();
        const newFiles = acceptedFiles.filter((f) => {
            const alreadyExists = afiles.some((af) => fileKey(af) == fileKey(f));
            return !alreadyExists;
        });
        console.log("newFiles", newFiles);
        if (newFiles.length != 0) {
            const component = new AudioComponent();
            component.name = fileKey(acceptedFiles[0]).replace(/\/.*/, "");
            const components = this.state.components.slice(0);
            components.push(component);
            Observable.fromArray(newFiles).concatMap((f) => {
                return wavHeader(f).flatMapObserver((onNext) => Observable.just(onNext), (onError) => {
                    console.error("cant read wav from ", f, onError);
                    return Observable.empty<WavHeader>();
                }, () => Observable.empty<WavHeader>()).filter((w) => w.channelLabels.length == 1).map((w) => new Pair(f, w));
            }).subscribe((fw) => {
                const chan = new Channel();
                const file = fw.first;
                const wav = fw.second;
                const key = fileKey(file);
                chan.id = key;
                chan.label = this.state.labelmap.get(key) || ChannelLabel.MONO;
                chan.samples = new WavSource(file, wav);
                chan.audioInfo = audioInfoFromWav(wav);
                chan.waveforms = new WaveformSourceImpl(chan.samples);
                this.channels.set(key, chan);
                component.files.push(file);
                this.setState({components});
            }, (err) => {
                window.alert(`cant read wav ${err}`);
            });
        }
    }

    private audiodrop() {
        return <Dropzone key="audiodrop" onDrop={(x) => this.onDropAudio(x)}>
            {({getRootProps, getInputProps}) => (
                <section>
                    <div {...getRootProps()} style={{width: "1280px", height: "80px", background: "#d2d2d2"}}>
                        <input {...getInputProps()} accept="audio/*"/>
                        <p>Drag 'n' drop audio files here</p>
                    </div>
                </section>
            )}
        </Dropzone>;
    }

    private audiodropFolder() {
        return <section key="audiodropFolder">
            <div style={{width: "1280px", height: "80px", background: "#d2d2d2", paddingTop: "10px"}}>
                <input accept="audio/*" multiple={true} type="file" autoComplete="off" tabIndex={-1}
                       ref={(el) => {
                           if (el) {
                               (el as any).webkitdirectory = true;
                           }
                       }} onChange={(c) => this.onDropAudio(Array.from(c.target.files))}/>
                <p>Drop folder here</p>
            </div>
        </section>;
    }
}
