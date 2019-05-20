import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import GridList from "@material-ui/core/GridList";
import GridListTile from "@material-ui/core/GridListTile";
import IconButton from "@material-ui/core/IconButton";
import ListSubheader from "@material-ui/core/ListSubheader";
import Switch from "@material-ui/core/Switch";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import MoreVert from "@material-ui/icons/MoreVert";
import Waves from "@material-ui/icons/Waves";
import {_private, Player} from "@sysval/vgplayer-core";
import {com, konform, org} from "konform";
import {kotlin, Long} from "kotlin";
import * as React from "react";
import AudioChannelComponent from "./AudioChannelComponent";
import AudioChannelSettingsComponent from "./AudioChannelSettingsComponent";
import SpeedDials from "./MyFab";
import {SeekablePlayerComponent} from "./PlayerComponent";
import {fileKey, newSampleRange, WAVECOLORS, ZERO} from "./utils";
import {WorkerClient} from "./workerclient";
import ChannelLabel = org.jcodec.common.model.ChannelLabel;
import Observable = Rx.Observable;
import Pair = kotlin.Pair;
import AudioInfo = _private.AudioInfo;
import WavHeader = org.jcodec.codecs.wav.WavHeader;
import ResampleFilter = konform.ResampleFilter;
import FastAudioIndex = com.vg.audio.FastAudioIndex;
import SampleRange = com.vg.audio.SampleRange;
import wavHeader = konform.wavHeader;
import WavSource = konform.WavSource;
import WaveformSourceImpl = konform.WaveformSourceImpl;
import {AudioComponent, Channel} from "./model";
import AudioComponentSettingsComponent from "./AudioComponentSettingsComponent";

interface AudioConformState {
    vfile: File;
    components: AudioComponent[];
    masterAudio: File;
    soloed: Set<File>;
    labelmap: Map<string, ChannelLabel>;
    vtime: number;
    showSettingsForComponent?: string;
    showSettingsForChannel?: string;
    checkedForConform: Set<string>;
    forceSampleRate: Map<string, number>;
    indexProgress: Map<string, Long>;
    foundOffsets: Map<string, number>;
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
        foundOffsets: new Map<string, number>(),
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

    public downloadIndex(id: string) {
        this.indexes.get(id).subscribe((idx) => {
            // https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
            const blob = konform.indexToBlob(idx);
            console.log(blob);
            const a = window.document.createElement("a");
            a.href = window.URL.createObjectURL(blob);
            a.download = `${id}.idx`;

            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
        });
    }

    public render(): React.ReactNode {
        // console.log("render", this);
        (window as any).hackConformApp = this;

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
            {this.channelsettings()}
            {this.componentsettings()}
        </div>;
    }

    private channelsettings() {
        if (!this.state.showSettingsForChannel) {
            return null;
        }
        const key = `settings-${this.state.showSettingsForChannel}`;
        return <AudioChannelSettingsComponent key={key} channel={this.channels.get(this.state.showSettingsForChannel)}
                                              offset={(this.state.foundOffsets.get(this.state.showSettingsForChannel) || 0)}
                                              open={!!this.state.showSettingsForChannel}
                                              onCancel={(c) => this.setState({showSettingsForChannel: undefined})}
                                              onOk={(c) => {
                                                  console.log("save settings for channel ", c);
                                                  const ch = this.channels.get(c.id);
                                                  if (c.label) {
                                                      this.state.labelmap.set(c.id, c.label);
                                                      if (ch != null) {
                                                          ch.label = c.label;
                                                      }
                                                  }
                                                  if (c.sampleRate) {
                                                      this.state.forceSampleRate.set(c.id, c.sampleRate);
                                                      if (ch != null) {
                                                          ch.forceSampleRate = c.sampleRate;
                                                      }
                                                  }
                                                  if (c.offset) {
                                                      this.state.foundOffsets.set(c.id, c.offset);
                                                  }

                                                  this.setState({
                                                      showSettingsForChannel: undefined,
                                                      labelmap: this.state.labelmap,
                                                      forceSampleRate: this.state.forceSampleRate,
                                                      foundOffsets: this.state.foundOffsets,
                                                  });
                                              }}/>;
    }

    private componentsettings() {
        if (!this.state.showSettingsForComponent) {
            return null;
        }
        const component = this.state.components.find(it => it.name == this.state.showSettingsForComponent);
        if (!component) {
            return null;
        }
        const offset = component.files.map(f => this.state.foundOffsets.get(fileKey(f)) || 0).reduce((prev, cur) => Math.max(prev, cur), 0);
        const key = `settings-${this.state.showSettingsForComponent}`;
        return <AudioComponentSettingsComponent key={key}
                                                component={component}
                                                offset={offset}
                                                open={!!this.state.showSettingsForComponent}
                                                onCancel={(c) => this.setState({showSettingsForComponent: undefined})}
                                                onOk={(c) => {
                                                    console.log("save settings for component ", c);
                                                    if (c.color) {
                                                        component.color = c.color;
                                                    }
                                                    component.files.map(f => this.channels.get(fileKey(f))).filter(ch => ch != null).forEach(ch => {
                                                        if (c.sampleRate) {
                                                            this.state.forceSampleRate.set(ch.id, c.sampleRate);
                                                            ch.forceSampleRate = c.sampleRate;
                                                        }
                                                        if (c.offset) {
                                                            this.state.foundOffsets.set(ch.id, c.offset);
                                                        }
                                                        if (c.color) {
                                                            ch.color = c.color;
                                                        }
                                                    });

                                                    this.setState({
                                                        showSettingsForComponent: undefined,
                                                        forceSampleRate: this.state.forceSampleRate,
                                                        foundOffsets: this.state.foundOffsets,
                                                        components: this.state.components,
                                                    });
                                                }}/>;
    }

    private indexChannel(c: Channel): Observable<FastAudioIndex> {
        return konform.indexFromMonoSource(c.samples, c.audioInfo.sampleRate, (e: Long) => {
            const before = (this.state.indexProgress.get(c.id) || ZERO).toNumber();
            const updated = e.toNumber();
            if (updated - before > 10 * 48000) {
                // console.log("index", c.id, e.toNumber());
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
                const masterOffset = this.state.foundOffsets.get(mc.id) || 0;
                const offset = r.second;
                this.state.foundOffsets.set(r.first, offset + masterOffset);

                console.log("foundOffsets", r.first, offset, masterOffset, this.state.foundOffsets);
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
            <Switch value="checkedC"/><Typography variant="caption" gutterBottom> Conform mode </Typography>
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

    private samplerange(key: string): SampleRange {
        let endsec: number;
        if (this.player) {
            endsec = this.player.getDurationSec();
        }

        const startSec = 0;

        const channel = this.channels.get(key);
        const offset = (this.state.foundOffsets.get(key) || 0);
        const startSample = ((startSec || 0) * channel.audioInfo.sampleRate) - offset;
        const endSample = ((endsec * channel.audioInfo.sampleRate) || (channel.audioInfo.totalSamples - 1)) - offset;
        return newSampleRange(startSample, endSample);
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
        const offset = (this.state.foundOffsets.get(key) || 0);
        const label = this.state.labelmap.get(key) || ChannelLabel.MONO;
        const sampleRange = this.samplerange(key);

        // console.log("sampleRange", (sampleRange || {}).toString());

        return <AudioChannelComponent isMaster={isMaster}
                                      isCheckedForConform={this.state.checkedForConform.has(key)}
                                      isSoloed={this.state.soloed.has(file)}
                                      channel={channel}
                                      forceSampleRate={this.state.forceSampleRate.get(key)}
                                      label={label}
                                      offset={offset}
                                      startSec={0}
                                      endSec={endsec}
                                      sampleRange={sampleRange}
                                      selection={selectionRange}
                                      onSolo={(c) => {
                                          if (this.state.soloed.has(file)) {
                                              this.state.soloed.delete(file);
                                          } else {
                                              this.state.soloed.add(file);
                                          }
                                          this.setState({soloed: this.state.soloed});
                                      }}
                                      onSetMaster={(c) => {
                                          this.state.checkedForConform.delete(key);
                                          return this.setState({
                                              checkedForConform: this.state.checkedForConform,
                                              masterAudio: file,
                                          });
                                      }}
                                      onCheckedForConform={(e) => {
                                          if (this.state.checkedForConform.has(key)) {
                                              this.state.checkedForConform.delete(key);
                                          } else {
                                              this.state.checkedForConform.add(key);
                                          }
                                          console.log("checkedForConform", this.state.checkedForConform);
                                          this.setState({checkedForConform: this.state.checkedForConform});
                                      }} onSettings={(e) => this.setState({showSettingsForChannel: channel.id})}/>;
    }

    private audio(): React.ReactNode {
        const comps: React.ReactNode[] = this.state.components.map((comp) => {
            return <GridList cellHeight={80} cols={1}>
                <GridListTile key="Subheader" style={{height: "auto"}}>
                    <ListSubheader component="div">{comp.name}
                        <IconButton
                            key={`color-${comp.name}`}
                            onClick={(it) => this.setState({showSettingsForComponent: comp.name})}><Waves
                            nativeColor={comp.color} fontSize="small"/> </IconButton>
                        <Tooltip title="Component Settings" aria-label="Component Settings">
                            <IconButton
                                key={`settings-${comp.name}`}
                                onClick={(it) => this.setState({showSettingsForComponent: comp.name})}><MoreVert
                                fontSize="small"/> </IconButton>
                        </Tooltip>
                    </ListSubheader>
                </GridListTile>
                {comp.files.map((file) => {
                    const key = fileKey(file);
                    return <GridListTile key={key}>{this.audiochannel(file)}</GridListTile>;
                })}
            </GridList>;
        });
        if (this.state.masterAudio) {
            comps.unshift(<div style={{
                border: "1px",
                borderStyle: "dashed",
                borderColor: "darkgreen",
                width: "100%",
                marginTop: "10px",
            }}>{this.audiochannel(this.state.masterAudio)}</div>);
        }
        return comps;
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
            component.color = WAVECOLORS[(Math.random() * WAVECOLORS.length) | 0];
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
                chan.color = component.color;
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
                       onChange={(c) => this.onDropAudio(Array.from(c.target.files).sort((a: File, b: File) => a.name.localeCompare(b.name)))}/>
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
                       }}
                       onChange={(c) => this.onDropAudio(Array.from(c.target.files).sort((a: File, b: File) => a.name.localeCompare(b.name)))}/>
                <label htmlFor="uploadfolder-button-file">
                    <Button variant="contained" color="default" component="span"> Audio Folder <CloudUploadIcon/>
                    </Button>
                </label>
            </Grid>
        </section>;
    }
}
