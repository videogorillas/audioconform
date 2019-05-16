import Button from "@material-ui/core/Button";
import Checkbox from "@material-ui/core/Checkbox";
import ExpansionPanel from "@material-ui/core/ExpansionPanel";
import ExpansionPanelDetails from "@material-ui/core/ExpansionPanelDetails";
import ExpansionPanelSummary from "@material-ui/core/ExpansionPanelSummary";
import FormControl from "@material-ui/core/FormControl";
import FormHelperText from "@material-ui/core/FormHelperText";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import Typography from "@material-ui/core/Typography";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import StarBorder from "@material-ui/icons/StarBorder";
import StarRate from "@material-ui/icons/StarRate";
import {_private, Player} from "@sysval/vgplayer-core";
import {com, konform, org} from "konform";
import {kotlin, Long} from "kotlin";
import * as React from "react";
import SpeedDials from "./MyFab";
import {Channel, SeekablePlayerComponent} from "./PlayerComponent";
import {fileKey, labelFromString, newSampleRange} from "./utils";
import WaveCanvas from "./WaveCanvas";
import {WorkerClient} from "./workerclient";
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
    workerClient: WorkerClient;
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

    private indexes = new Map<string, Observable<FastAudioIndex>>();

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

        return <div style={{width: "100%", position: "relative"}}><Grid container direction="column" spacing={16}>
            <Grid item={true}>
                {this.videodrop()}
            </Grid>
            <Grid item={true}>
                {this.conformbutton()}
            </Grid>
            <Grid item={true}>
                {this.audio()}
            </Grid>
            <Grid item={true}>
                {this.audiodrop()}
            </Grid>
            <Grid item={true}>
                {this.audiodropFolder()}
            </Grid>
        </Grid>
            <div style={{position: "absolute", bottom: "48px", right: "48px"}}><SpeedDials/></div>
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

    private indexForChannel(mc: Channel): Observable<FastAudioIndex> {
        const key = `${mc.id}:${mc.forceSampleRate}`;
        if (!this.indexes.has(key)) {
            this.indexes.set(key, this.indexChannel(mc).shareReplay());
        }
        return this.indexes.get(key);
    }

    private theconform() {
        const mc = this.makeChannelFromFile(this.state.masterAudio);
        const ccs = this.audioForConform().map((f) => this.makeChannelFromFile(f));

        const mi = this.indexForChannel(mc);

        const cis = Observable.fromArray(ccs).concatMap((c) => {
            return this.indexForChannel(c).map((cidx) => new Pair(c.id, cidx));
        });
        mi.subscribe((idx: FastAudioIndex) => {
            cis.flatMap((cidx) => {
                const id = cidx.first;
                console.log("cidx", cidx);
                return this.props.workerClient.matchOffsets(idx, cidx.second).map((r) => new Pair(id, r.best));
            }).subscribe((r) => {
                this.state.foundOffsets.set(r.first, Long.fromNumber(r.second));
                this.setState({foundOffsets: this.state.foundOffsets});
            }, (err: any) => console.log("cidx err", err));
        }, (err: any) => console.log("idx err", err));
    }

    private conformbutton() {
        const enabled = this.state.vfile != null && this.state.masterAudio != null && this.audioForConform().length != 0;
        return <Grid
            container
            direction="row"
            justify="center"
            alignItems="center"
        >
            <Button variant="contained" color="primary" disabled={!enabled}
                    onClick={(e) => this.theconform()}>Conform</Button>
        </Grid>;
    }

    private audioForConform(): File[] {
        return this.audioFiles().filter((f) => this.state.checkedForConform.has(fileKey(f)));
    }

    private videodrop(): React.ReactNode {
        if (this.state.vfile == null) {
            return <Grid
                style={{height: "720px", background: "#424242"}}
                container
                direction="row"
                justify="center"
                alignItems="center"
            >
                <input id="uploadvideo-button-file" style={{display: "none"}} accept="video/*" multiple={false}
                       type="file" autoComplete="off" tabIndex={-1}
                       onChange={(c) => {
                           this.setState({vfile: Array.from(c.target.files)[0]});
                       }}/>
                <label htmlFor="uploadvideo-button-file">
                    <Button variant="contained" color="default" component="span"> Video <CloudUploadIcon/>
                    </Button>
                </label>
            </Grid>;
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
        const hzs = [47952, 48000];
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
            <FormHelperText>{key}</FormHelperText> <Select
            value={hz}
            inputProps={{
                name: "hz",
                id: "hz-simple",
            }}
            onChange={(it) => {
                console.log("hzselect", it.target.value);
                const newhz = (parseInt(it.target.value) | 0) || 48000;
                this.state.forceSampleRate.set(key, newhz);
                this.setState({forceSampleRate: this.state.forceSampleRate});
            }}
        >
            {
                hzs.map((hzv) => {
                    return <MenuItem value={hzv}>{hzv}</MenuItem>;
                })
            }
        </Select>

            {/*<div style={{position: "absolute"}} onClick={(e) => {*/}
            {/*    const newhz = hz == 48000 ? 47952 : 48000;*/}
            {/*    */}
            {/*    this.setState({forceSampleRate: this.state.forceSampleRate});*/}
            {/*}}>{key} {hz}Hz {offsetString}*/}
            {/*</div>*/}
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

    private audio(): React.ReactNode {
        const comps: React.ReactNode[] = this.state.components.map((comp) => {
            return <ExpansionPanel key={comp.name}>
                <ExpansionPanelSummary expandIcon={<ExpandMoreIcon/>}>
                    <Typography>{comp.name}</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                    <List>
                        {comp.files.map((file) => {
                            return <ListItem> {this.audiochannel(file)}</ListItem>;
                        })}
                    </List>
                </ExpansionPanelDetails>
            </ExpansionPanel>;
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

        return <div key={`soloselect-${key}`} style={{position: "absolute", top: "0px", right: "20px"}}><FormControl>
            {/*<InputLabel htmlFor="label-simple">Label</InputLabel>*/}
            <Select
                value={currentLabel.toString()}
                inputProps={{
                    name: "label",
                    id: "label-simple",
                }}
                onChange={(it) => {
                    console.log("labelselect", it.target.value);
                    const label = labelFromString(it.target.value) || ChannelLabel.MONO;
                    const lm = this.state.labelmap;
                    lm.set(key, label);
                    const c = this.channels.get(key);
                    if (c != null) {
                        c.label = label;
                    }
                    this.setState({labelmap: lm});
                }}
            >
                {
                    ChannelLabel.values().map((label) => {
                        return <MenuItem value={label.toString()}>{label.toString()}</MenuItem>;
                    })
                }
            </Select>
        </FormControl></div>;
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
        return <section key="audiodropFolder">
            <Grid
                style={{height: "80px"}}
                container
                direction="row"
                justify="center"
                alignItems="center"
            >
                <input id="uploadfiles-button-file" style={{display: "none"}} accept="audio/*" multiple={true}
                       type="file" autoComplete="off" tabIndex={-1}
                       onChange={(c) => this.onDropAudio(Array.from(c.target.files))}/>
                <label htmlFor="uploadfiles-button-file">
                    <Button variant="contained" color="default" component="span"> Audio Files <CloudUploadIcon/>
                    </Button>
                </label>
            </Grid>
        </section>;

    }

    private audiodropFolder() {
        return <section key="audiodropFolder">
            <Grid
                style={{height: "80px", background: "#424242"}}
                container
                direction="row"
                justify="center"
                alignItems="center"
            >
                <input id="uploadfolder-button-file" style={{display: "none"}} accept="audio/*" multiple={true}
                       type="file" autoComplete="off" tabIndex={-1}
                       ref={(el) => {
                           if (el) {
                               (el as any).webkitdirectory = true;
                           }
                       }} onChange={(c) => this.onDropAudio(Array.from(c.target.files))}/>
                <label htmlFor="uploadfolder-button-file">
                    <Button variant="contained" color="default" component="span"> Audio Folder <CloudUploadIcon/>
                    </Button>
                </label>
            </Grid>
        </section>;
    }
}
