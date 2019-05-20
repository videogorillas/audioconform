import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import * as React from "react";
import {AudioComponent} from "./model";

interface AudioComponentSettingsComponentProps {
    component: AudioComponent;
    offset: number;
    sampleRate?: number;
    open: boolean;
    onCancel?: (c: AudioComponent) => void;
    onOk?: (c: ComponentChanges) => void;
}

interface AudioComponentSettingsComponentState {
    sampleRate?: number;
    offset?: number;
}

interface ComponentChanges {
    id: string;
    sampleRate?: number;
    offset?: number;
}

export default class AudioComponentSettingsComponent extends React.Component<AudioComponentSettingsComponentProps, AudioComponentSettingsComponentState> {
    public state: AudioComponentSettingsComponentState = {};

    public render(): React.ReactElement {
        const component = this.props.component || new AudioComponent();
        return <Dialog
            key="dialog"
            fullWidth
            maxWidth="md"
            disableBackdropClick={false}
            disableEscapeKeyDown={false}
            open={this.props.open}
            onClose={(x) => this.props.onCancel(component)}
        >
            <DialogTitle>{component.name || ""}</DialogTitle>
            <DialogContent>
                <InputLabel key="samplerate-input" htmlFor="sampleRate-simple">Hz</InputLabel>
                <Select key="samplerate-select"
                        value={this.state.sampleRate || this.props.sampleRate}
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
                    this.props.onCancel(component);
                }} color="primary">
                    Cancel
                </Button>
                <Button key="ok" onClick={(x) => {
                    this.setState({});
                    const changes: ComponentChanges = {
                        id: this.props.component.name,
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

    private samplerates() {
        return [48000, 47952].map((label) => <MenuItem value={label}>{label}</MenuItem>);
    }
}
