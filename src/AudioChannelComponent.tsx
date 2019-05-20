import Checkbox from "@material-ui/core/Checkbox";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Hearing from "@material-ui/icons/Hearing";
import Settings from "@material-ui/icons/Settings";
import StarBorder from "@material-ui/icons/StarBorder";
import StarRate from "@material-ui/icons/StarRate";
import {com, org} from "konform";
import * as React from "react";
import {newSampleRange} from "./utils";
import WaveCanvas from "./WaveCanvas";
import SampleRange = com.vg.audio.SampleRange;
import ChannelLabel = org.jcodec.common.model.ChannelLabel;
import {Channel} from "./model";

interface AudioChannelComponentProps {
    isMaster: boolean;
    isCheckedForConform: boolean;
    isSoloed: boolean;

    channel: Channel;
    forceSampleRate: number;
    label: ChannelLabel;
    offset: number;

    startSec: number;
    endSec: number;
    sampleRange: SampleRange;

    selection: SampleRange;

    onSolo: (c: Channel) => void;
    onSetMaster: (c: Channel) => void;
    onCheckedForConform: (c: Channel) => void;
    onSettings: (c: Channel) => void;
}

interface AudioChannelComponentState {
    showSeekHelper: boolean;
    seekHelperX: number;
}

export default class AudioChannelComponent extends React.Component<AudioChannelComponentProps, AudioChannelComponentState> {
    state: AudioChannelComponentState = {
        showSeekHelper: false,
        seekHelperX: 0,
    };

    private samplerange(): SampleRange {
        if (this.props.sampleRange) {
            return this.props.sampleRange;
        }
        const endsec = this.props.endSec;
        const channel = this.props.channel;
        const offset = this.props.offset || 0;
        const startSample = ((this.props.startSec || 0) * channel.audioInfo.sampleRate) - offset;
        const endSample = ((endsec * channel.audioInfo.sampleRate) || (channel.audioInfo.totalSamples - 1)) - offset;
        return newSampleRange(startSample, endSample);
    }

    public render(): React.ReactElement {
        const key = this.props.channel.id;
        const channel = this.props.channel;
        const hz = this.props.forceSampleRate || channel.audioInfo.sampleRate;
        const selectionRange = this.props.selection;
        const sampleRange = this.samplerange();
        // console.log("sampleRange", key, (sampleRange || {}).toString());

        const offsetString = this.props.offset ? `${this.props.offset}` : "";
        const label = this.props.label || ChannelLabel.MONO;
        const niceName = key.replace(/.*\//, "");

        return <div key={key} style={{width: "100%", height: "80px", position: "relative"}}>
            <div style={{
                position: "absolute",
                left: `${this.state.seekHelperX}px`,
                height: (this.state.showSeekHelper ? "80px" : "0px"),
                width: "0px",
                borderLeft: "1px dashed rgba(0,0,0,0.3)",
                pointerEvents: "none",
            }}/>
            <div style={{position: "absolute", left: "0px", width: "100%"}}
                 onMouseOver={() => this.setState({showSeekHelper: true})}
                 onMouseOut={() => this.setState({showSeekHelper: false})}
                 onMouseMove={(it) => this.setState({seekHelperX: it.nativeEvent.offsetX})}
            >
                <WaveCanvas key={`wave-${key}`} channel={channel} sampleRange={sampleRange}
                            selectRange={selectionRange}/>
            </div>
            <Typography variant="caption"
                        gutterBottom> {niceName} {hz} {label.toString()} <span onClick={it => console.log("offset clicked", offsetString)}>{offsetString}</span></Typography>
            {this.settings()}
            {this.star()}
            {this.solounsolo()}
            {this.checkbox()}
            {/*<CircularProgress color="secondary"/>*/}
        </div>;
    }

    private settings() {
        const key = this.props.channel.id;
        return <IconButton
            key={`settings-${key}`}
            onClick={(it) => this.props.onSettings(this.props.channel)}><Settings fontSize="small"/> </IconButton>;
    }

    private star() {
        const key = this.props.channel.id;
        return <Tooltip title="Mark as master" aria-label="Mark as master">
            <IconButton key={`makemaster-${key}`}
                        onClick={(it) => {
                            if (this.props.onSetMaster) {
                                this.props.onSetMaster(this.props.channel);
                            }
                        }}>
                {this.props.isMaster ? <StarRate fontSize="small"/> : <StarBorder fontSize="small"/>}
            </IconButton>
        </Tooltip>;
    }

    private checkbox(): React.ReactNode {
        if (this.props.isMaster) {
            return null;
        }
        return <Tooltip title="Conform" aria-label="Conform">
            <Checkbox
                checked={this.props.isCheckedForConform}
                onChange={(e) => {
                    if (this.props.onCheckedForConform) {
                        this.props.onCheckedForConform(this.props.channel);
                    }
                }}
                value="checkedA"
            />
        </Tooltip>;
    }

    private solounsolo() {
        const isSoloed = this.props.isSoloed;
        const key = this.props.channel.id;
        return <Tooltip title={isSoloed ? "Unsolo" : "Solo "} aria-label="Solo">
            <IconButton key={`solounsolo-${key}`} onClick={(it) => {
                if (this.props.onSolo) {
                    this.props.onSolo(this.props.channel);
                }
            }}>
                <Hearing color={isSoloed ? undefined : "disabled"} fontSize="small"/>
            </IconButton>
        </Tooltip>;
    }
}
