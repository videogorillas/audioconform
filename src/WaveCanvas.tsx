import {com, konform} from "konform";
import React = require("react");
import {DEFAULT_COLOR, live4red, newSampleRange} from "./utils";
import CssWaveCollider = konform.CssWaveCollider;
import SampleRange = com.vg.audio.SampleRange;
import Observable = Rx.Observable;
import IDisposable = Rx.IDisposable;
import {Channel} from "./model";

interface WaveCanvasProps {
    channel: Channel;
    sampleRange?: SampleRange;
    startSec?: number;
    endSec?: number;
    selectRange?: SampleRange;
    color?: string;
}

interface WaveCanvasState {
}

function samplerange(props: WaveCanvasProps): SampleRange {
    const sampleRate = props.channel.audioInfo.sampleRate;
    const sampleCount = props.channel.audioInfo.totalSamples;

    if (props.sampleRange) {
        return props.sampleRange;
    }
    if (props.endSec || props.startSec) {
        const start = (props.startSec || 0) * sampleRate;
        const end = (props.endSec || 0) * sampleRate || (sampleCount - 1);
        const sampleRange = newSampleRange(start, end);
        return sampleRange;
    }
    return newSampleRange(0, sampleCount - 1);
}

function str(o: any) {
    if (o) {
        return o.toString();
    }
    return "null";
}

export default class WaveCanvas extends React.Component<WaveCanvasProps, WaveCanvasState> {
    private canvasel: HTMLCanvasElement = null;
    private collider: CssWaveCollider = null;

    public shouldComponentUpdate(nextProps: Readonly<WaveCanvasProps>, nextState: Readonly<WaveCanvasState>, nextContext: any): boolean {
        return false;
    }

    public componentWillReceiveProps(nextProps: Readonly<WaveCanvasProps>, nextContext: any): void {
        // console.log("componentWillReceiveProps");
        const nextsr = samplerange(nextProps);
        const cursr = samplerange(this.props);
        const update = nextsr.toString() != cursr.toString() || str(this.props.selectRange) != str(nextProps.selectRange) || str(this.props.color) != str(nextProps.color);
        // console.log("componentWillReceiveProps", str(nextsr), str(cursr), str(this.props.selectRange), str(nextProps.selectRange), update);
        if (update) {
            this.collider.waveColor = nextProps.color || DEFAULT_COLOR;
            this.collider.drawWave(nextsr, nextProps.selectRange);
        }
    }

    public componentDidMount(): void {
        console.log("componentDidMount");
        const file = this.props.channel;
        console.log("canvasel", file, this.canvasel);
        const ctx = this.canvasel.getContext("2d");
        ctx.fillStyle = live4red;
        ctx.fillText(`loading ${this.props.channel.id}`, 42, 42);
        this.initCollider(this.props.channel);
        this.collider.drawWave(samplerange(this.props), this.props.selectRange);
    }

    public render(): React.ReactNode {
        console.log("render file2", this.props.channel.id);

        return <canvas key={this.props.channel.id} style={{width: "100%", height: "80px"}} width="1280" height="80"
                       ref={(ref) => {
                           if (ref == null) {
                               return;
                           }
                           this.canvasel = ref;
                       }}/>;
    }

    public componentDidUpdate(): void {
        console.log("componentDidUpdate", this.canvasel);
    }

    private dragDispose: IDisposable;

    private initCollider(channel: Channel) {
        console.log("initCollider", channel);
        const sampleRate = channel.audioInfo.sampleRate;

        this.collider = new CssWaveCollider(channel.waveforms, this.canvasel);
        this.collider.waveColor = channel.color || DEFAULT_COLOR;
        (window as any)[`collider${channel.id}`] = this.collider;
        const down = Observable.fromEvent(this.canvasel, "mousedown").filter((it: MouseEvent) => it.altKey);
        const up = Observable.fromEvent(this.canvasel, "mouseup");
        const move = Observable.fromEvent(this.canvasel, "mousemove");
        if (this.dragDispose) {
            this.dragDispose.dispose();
        }
        this.dragDispose = down.flatMap(x => {
            return move.takeUntil(up);
        }).subscribe(ok => {
            console.log("drag", ok);
        });
    }
}
