import Collapse from "@material-ui/core/Collapse";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import ExpandLess from "@material-ui/icons/ExpandLess";
import ExpandMore from "@material-ui/icons/ExpandMore";
import LibraryMusic from "@material-ui/icons/LibraryMusic";
import StarBorder from "@material-ui/icons/StarBorder";
import * as React from "react";
import {AudioComponent} from "./model";
import StarRate from "@material-ui/icons/StarRate";
import Tooltip from "@material-ui/core/Tooltip";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import Hearing from "@material-ui/icons/Hearing";

interface AudioListComponentProps {
    components: AudioComponent[];
    selected: string[];
    soloed: string[];
    masterAudioId: string;
    onChannelsSelected: (chids: string[]) => void;
    onSetMaster: (chid: string) => void;
    onSolo: (chid: string) => void;
}

interface AudioListComponentState {
    opencomponents: Set<string>;
    selectionAnchor?: string;
    selected: string[];
    masterAudioId?: string;
}

export class AudioListComponent extends React.Component<AudioListComponentProps, AudioListComponentState> {
    public state: AudioListComponentState = {
        opencomponents: new Set<string>(),
        selected: [],
    };

    public render(): React.ReactElement {
        return <List
            component="nav"
            subheader={<ListSubheader component="div">Audio Components</ListSubheader>}
        >
            {this.props.components.flatMap((comp) => {
                const cid = comp.name;
                const componentSelected = comp.channels.some(ch => this.state.selected.indexOf(ch.id) >= 0);
                return [
                    <ListItem dense selected={componentSelected}>
                        <ListItemIcon>
                            <LibraryMusic nativeColor={comp.color} fontSize="small"/>
                        </ListItemIcon>
                        <ListItemText inset primary={cid} primaryTypographyProps={{variant: "overline"}}/>
                        <IconButton onClick={(it) => this.opencomp(cid)}>{this.state.opencomponents.has(cid) ?
                            <ExpandLess fontSize="small"/> : <ExpandMore fontSize="small"/>}</IconButton>
                    </ListItem>,
                    <Collapse in={this.state.opencomponents.has(cid)} timeout="auto" unmountOnExit>
                        <List disablePadding>
                            {comp.channels.map((c) => {
                                const chid = c.id;
                                const niceName = c.id.replace(/.*\//, "");
                                const isMaster = c.id == this.props.masterAudioId;
                                const isSoloed = (this.props.soloed || []).indexOf(c.id) >= 0;
                                return <ListItem dense button selected={this.state.selected.some(it => it == chid)}
                                                 onClick={it => {
                                                     console.log("onClick", chid, it.shiftKey);
                                                     if (it.shiftKey) {
                                                         const chids = this.props.components.flatMap(c => c.channels.map(ch => ch.id));
                                                         let ancidx = 0;
                                                         if (this.state.selectionAnchor) {
                                                             ancidx = chids.indexOf(this.state.selectionAnchor);
                                                         }
                                                         const curidx = chids.indexOf(chid);
                                                         const startidx = Math.min(ancidx, curidx);
                                                         const endidx = Math.max(ancidx, curidx);
                                                         const selected = chids.slice(startidx, endidx + 1);
                                                         console.log(selected);
                                                         this.setState({selected: selected});
                                                         this.props.onChannelsSelected(selected);
                                                     } else {
                                                         this.setState({selected: [chid], selectionAnchor: chid});
                                                         this.props.onChannelsSelected([chid]);
                                                     }
                                                 }}>
                                    <ListItemIcon>
                                        <Tooltip title="Mark as master" aria-label="Mark as master">
                                            <IconButton key={`makemaster-${chid}`}
                                                        onClick={(it) => this.props.onSetMaster(chid)}>
                                                {isMaster ? <StarRate fontSize="small"/> :
                                                    <StarBorder fontSize="small"/>}
                                            </IconButton>
                                        </Tooltip>
                                    </ListItemIcon>
                                    <ListItemText inset primary={`${niceName} ${c.label}`}
                                                  primaryTypographyProps={{variant: "caption"}}/>
                                    <ListItemSecondaryAction>
                                        <Tooltip title={isSoloed ? "Unsolo" : "Solo "} aria-label="Solo">
                                            <IconButton key={`solounsolo-${chid}`} onClick={(it) => {
                                                this.props.onSolo(chid);
                                            }}>
                                                <Hearing color={isSoloed ? undefined : "disabled"} fontSize="small"/>
                                            </IconButton>
                                        </Tooltip>
                                    </ListItemSecondaryAction>
                                </ListItem>;
                            })}
                        </List>
                    </Collapse>,
                ];

            })}
        </List>;

    }

    private opencomp(cid: string) {
        if (this.state.opencomponents.has(cid)) {
            this.state.opencomponents.delete(cid);
        } else {
            this.state.opencomponents.add(cid);
        }
        this.setState({opencomponents: this.state.opencomponents});
    }
}
