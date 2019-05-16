import DeleteIcon from "@material-ui/icons/Delete";
import FileCopyIcon from "@material-ui/icons/FileCopyOutlined";
import PrintIcon from "@material-ui/icons/Print";
import SaveIcon from "@material-ui/icons/Save";
import ShareIcon from "@material-ui/icons/Share";
import SpeedDial from "@material-ui/lab/SpeedDial";
import SpeedDialAction from "@material-ui/lab/SpeedDialAction";
import SpeedDialIcon from "@material-ui/lab/SpeedDialIcon";
import * as React from "react";

const styles = (theme: any) => ({
    root: {
        width: "100%",
    },
    controls: {
        margin: theme.spacing.unit * 3,
    },
    exampleWrapper: {
        position: "relative",
        height: 380,
    },
    radioGroup: {
        margin: `${theme.spacing.unit}px 0`,
    },
    speedDial: {
        "position": "absolute",
        "&$directionUp, &$directionLeft": {
            bottom: theme.spacing.unit * 2,
            right: theme.spacing.unit * 3,
        },
        "&$directionDown, &$directionRight": {
            top: theme.spacing.unit * 2,
            left: theme.spacing.unit * 3,
        },
    },
    directionUp: {},
    directionRight: {},
    directionDown: {},
    directionLeft: {},
});

const actions = [
    {icon: <FileCopyIcon/>, name: "Copy"},
    {icon: <SaveIcon/>, name: "Save"},
    {icon: <PrintIcon/>, name: "Print"},
    {icon: <ShareIcon/>, name: "Share"},
    {icon: <DeleteIcon/>, name: "Delete"},
];

interface SpeedDialsProps {

}

interface SpeedDialsState {
    direction?: string;
    open?: boolean;
    hidden?: boolean;
}

export default class SpeedDials extends React.Component<SpeedDialsProps, SpeedDialsState> {
    public state: SpeedDialsState = {
        direction: "up",
        open: false,
        hidden: false,
    };

    public handleClick = () => {
        this.setState((state) => ({
            open: !state.open,
        }));
    }

    public handleClose = () => {
        this.setState({open: false});
    }

    public handleOpen = () => {
        this.setState({open: true});
    }

    public render() {
        const {direction, hidden, open} = this.state;

        return (
            <SpeedDial
                ariaLabel="SpeedDial example"
                hidden={false}
                icon={<SpeedDialIcon/>}
                onBlur={this.handleClose}
                onClick={this.handleClick}
                onClose={this.handleClose}
                onFocus={this.handleOpen}
                onMouseEnter={this.handleOpen}
                onMouseLeave={this.handleClose}
                open={open}
                direction="up"
            >
                {actions.map((action) => (
                    <SpeedDialAction
                        key={action.name}
                        icon={action.icon}
                        tooltipTitle={action.name}
                        onClick={this.handleClick}
                    />
                ))}
            </SpeedDial>
        );
    }
}
