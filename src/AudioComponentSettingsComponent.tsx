import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import Menu from '@material-ui/core/Menu';
import * as React from "react";
import {AudioComponent} from "./model";
import {DEFAULT_COLOR, WAVECOLORS} from "./utils";
import {Typography} from "@material-ui/core";

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
    anchorEl?: HTMLElement;
    color?: string;
}

interface ComponentChanges {
    id: string;
    sampleRate?: number;
    offset?: number;
    color?: string;
}

export default class AudioComponentSettingsComponent extends React.Component<AudioComponentSettingsComponentProps, AudioComponentSettingsComponentState> {
    public state: AudioComponentSettingsComponentState = {};
    private handleClose = (color: string) => {
        console.log("handleClose", color);
        this.setState({anchorEl: null, color: color});
    };
    private handleClick = (event: any) => {
        this.setState({anchorEl: event.currentTarget as HTMLElement});
    };

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
                <Button
                    aria-owns={this.state.anchorEl ? 'simple-menu' : undefined}
                    aria-haspopup="true"
                    onClick={this.handleClick}
                    style={{color: this.state.color || component.color || DEFAULT_COLOR}}
                >
                    Color
                </Button>
                <Menu
                    id="simple-menu"
                    anchorEl={this.state.anchorEl}
                    open={Boolean(this.state.anchorEl)}
                    onClose={it => this.handleClose(undefined)}
                >
                    {WAVECOLORS.map(color => {
                        return <MenuItem key={color}
                                         onClick={it => {
                                             console.log(it, color);
                                             this.handleClose(color);
                                         }} style={{backgroundColor: color}}><Typography variant="caption">This
                            one</Typography></MenuItem>;
                    })}
                </Menu>
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
                        color: this.state.color,
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
