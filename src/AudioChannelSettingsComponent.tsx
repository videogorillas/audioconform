import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import {org} from "konform";
import {_private} from "@sysval/vgplayer-core";
import ChannelLabel = org.jcodec.common.model.ChannelLabel;
import AudioInfo = _private.AudioInfo;
import TextField from "@material-ui/core/TextField";
import * as React from "react";
import {labelFromString} from "./utils";
import {Channel} from "./model";

interface AudioChannelSettingsComponentProps {
    channel: Channel;
    offset: number;
    open: boolean;
    onCancel?: (c: Channel) => void;
    onOk?: (c: ChannelChanges) => void;
}

interface AudioChannelSettingsComponentState {
    label?: ChannelLabel;
    sampleRate?: number;
    offset?: number;
}

interface ChannelChanges {
    id: string;
    label?: ChannelLabel;
    sampleRate?: number;
    offset?: number;
}

export default class AudioChannelSettingsComponent extends React.Component<AudioChannelSettingsComponentProps, AudioChannelSettingsComponentState> {
    public state: AudioChannelSettingsComponentState = {};

    public render(): React.ReactElement {
        const channel = this.props.channel || new Channel();
        const audioInfo = channel.audioInfo || new AudioInfo();
        return <Dialog
            key="dialog"
            fullWidth
            maxWidth="md"
            disableBackdropClick={false}
            disableEscapeKeyDown={false}
            open={this.props.open}
            onClose={(x) => this.props.onCancel(channel)}
        >
            <DialogTitle>{channel.id || ""}</DialogTitle>
            <DialogContent>
                <InputLabel key="label-input" htmlFor="label-simple">Label</InputLabel>
                <Select key="label-select"
                        value={this.state.label || channel.label || ChannelLabel.MONO}
                        inputProps={{name: "label", id: "label-simple"}}
                        onChange={(it) => {
                            const label = labelFromString(it.target.value) || ChannelLabel.MONO;
                            this.setState({label});
                        }}
                >
                    {this.labels()}
                </Select>
                <InputLabel key="samplerate-input" htmlFor="sampleRate-simple">Hz</InputLabel>
                <Select key="samplerate-select"
                        value={this.state.sampleRate || channel.forceSampleRate || audioInfo.sampleRate || 48000}
                        inputProps={{name: "sampleRate", id: "sampleRate-simple"}}
                        onChange={(it) => {
                            const sampleRate = parseInt(it.target.value, 10) || 48000;
                            this.setState({sampleRate});
                        }}
                >
                    {this.samplerates()}
                </Select>

                <TextField
                    id="standard-number"
                    label="Offset"
                    value={this.state.offset || this.props.offset}
                    onChange={it => this.setState({offset: parseInt(it.target.value, 10) | 0})}
                    type="number"
                    InputLabelProps={{
                        shrink: true,
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button key="cancel" onClick={(x) => {
                    this.setState({});
                    this.props.onCancel(channel);
                }} color="primary">
                    Cancel
                </Button>
                <Button key="ok" onClick={(x) => {
                    this.setState({});
                    const changes: ChannelChanges = {
                        id: this.props.channel.id,
                        label: this.state.label,
                        sampleRate: this.state.sampleRate,
                        offset: this.state.offset,
                    };
                    this.props.onOk(changes);
                }} color="primary">
                    Ok
                </Button>
            </DialogActions>
        </Dialog>;
    }

    private labels() {
        return ChannelLabel.values().map((label) => <MenuItem value={label.toString()}>{label.toString()}</MenuItem>);
    }

    private samplerates() {
        return [48000, 47952].map((label) => <MenuItem value={label}>{label}</MenuItem>);
    }
}
