import {mp3} from "klame";
import {_private} from "@sysval/vgplayer-core";
import Mp3Encoder = mp3.Mp3Encoder;
import SegmentedAudioStream = _private.SegmentedAudioStream;
import AudioInfo = _private.AudioInfo;
import {konform} from "konform";
import SampleSource = konform.SampleSource;

const SILENCE_FRAME_48_128kb: Int8Array = new Int8Array(
    [-1, -5, -108, 4, 0, 15, -16, 0, 0, 105, 0, 0, 0, 8, 0, 0, 13, 32, 0, 0, 1, 0, 0, 1, -92, 0, 0, 0, 32, 0, 0, 52, -128, 0, 0, 4, 76, 65, 77, 69, 51, 46, 57, 57, 46, 53, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

export class SilenceAudioStream extends SegmentedAudioStream {
    private static framesPerSegment = 42 * 2;
    private static samplesPerSegment = SilenceAudioStream.framesPerSegment * 1152;
    private static segment: Int8Array = null;

    private durationSec: number;

    constructor(proxyId: string, durationSec: number) {
        super();
        this.durationSec = durationSec;
        this.proxyId = proxyId;
        this.id = proxyId;
        let ai = new AudioInfo();
        ai.audioType = "mp3";
        ai.channelCount = 2;
        ai.channelLabels = ["left", "right"];
        ai.sampleRate = 48000;
        ai.totalSamples = (durationSec * 48000) | 0;
        this.audioInfo = ai;
        this.sampleRate = 48000;
        this.totalSamples = ai.totalSamples;
        if (SilenceAudioStream.segment == null) {
            SilenceAudioStream.segment = new Int8Array(SilenceAudioStream.framesPerSegment * SILENCE_FRAME_48_128kb.byteLength);
            for (let i = 0; i < SilenceAudioStream.framesPerSegment; i++) {
                SilenceAudioStream.segment.set(SILENCE_FRAME_48_128kb, i * SILENCE_FRAME_48_128kb.byteLength);
            }
        }

        this.channelMuted = [false, false];
        this.mimeType = "audio/mpeg";
        this.BITRATE = 128;
    }

    silenceAppended(): boolean {
        return true;
    }

    //Mp3StereoSegmentedAudioStream doesnt grow or change seekable segments on the fly
    isDynamic(): boolean {
        return false;
    }

    getDashInit(onDone: (arg: ArrayBuffer) => void, onError: (arg: XMLHttpRequest) => void) {
        onDone(null);
    }

    getSegmentCount(): number {
        let frameCount = Math.ceil(this.totalSamples / 1152.0) | 0;
        return Math.ceil(frameCount / SilenceAudioStream.framesPerSegment) | 0;
    }

    loadSegment(segmentIdx: number, onDone: (arg: ArrayBuffer) => void, onError: (arg: Object) => void): () => void {
        console.log("silence segment", segmentIdx);
        onDone(SilenceAudioStream.segment.buffer);
        return () => {
        };
    }

    getDurationSec(): number {
        return this.durationSec;
    }

    getSegmentIdxByTime(time: number): number {
        let sample = (time * this.sampleRate) | 0;
        let frame = sample / 1152;
        return (frame / SilenceAudioStream.framesPerSegment) | 0;
    }

    getSegmentStartTime(idx: number): number {
        return (idx * SilenceAudioStream.samplesPerSegment / this.sampleRate)
    }

    getSegmentDuration(idx: number): number {
        return (SilenceAudioStream.samplesPerSegment / this.sampleRate)
    }
}

export class NullAudioStream extends SegmentedAudioStream {

    constructor(proxyId: string) {
        super();
        this.proxyId = proxyId;
        this.id = proxyId;
        let ai = new AudioInfo();
        ai.audioType = "mp3";
        ai.channelCount = 2;
        ai.channelLabels = ["left", "right"];
        ai.sampleRate = 48000;
        ai.totalSamples = 0;
        this.audioInfo = ai;
        this.sampleRate = 48000;
        this.totalSamples = 0;

        this.channelMuted = [false, false];
        this.mimeType = "audio/mpeg";
        this.BITRATE = 128;
    }

    silenceAppended(): boolean {
        return false;
    }

    //Mp3StereoSegmentedAudioStream doesnt grow or change seekable segments on the fly
    isDynamic(): boolean {
        return false;
    }

    getDashInit(onDone: (arg: ArrayBuffer) => void, onError: (arg: XMLHttpRequest) => void) {
        onDone(null);
    }

    getSegmentCount(): number {
        return 0;
    }

    loadSegment(segmentIdx: number, onDone: (arg: ArrayBuffer) => void, onError: (arg: Object) => void): () => void {
        console.log("noaudio segment", segmentIdx);
        onDone(new Int8Array(0).buffer);
        return () => {
        };
    }

    getDurationSec(): number {
        return 0.0;
    }

    getSegmentIdxByTime(time: number): number {
        return 0;
    }

    getSegmentStartTime(idx: number): number {
        return 0.0
    }

    getSegmentDuration(idx: number): number {
        return 0.0;
    }
}

function scale32k(samples: Float32Array): Float32Array {
    for (let j = 0; j < samples.length; j++) {
        samples[j] = samples[j] * 32767;
    }
    return samples;
}

export class Mp3StereoSegmentedAudioStream extends SegmentedAudioStream {
    static readonly framesPerSegment = 42 * 2;
    static readonly samplesPerSegment = Mp3StereoSegmentedAudioStream.framesPerSegment * 1152;

    private readonly mp3: Mp3Encoder;
    private readonly samples: SampleSource;
    private readonly frameCount: number;
    private readonly segmentCount: number;

    constructor(proxyId: string, audioInfo: AudioInfo, samples: SampleSource) {
        super();
        this.samples = samples;
        this.proxyId = proxyId;
        this.id = proxyId;
        let ai = new AudioInfo();
        ai.audioType = "mp3";
        ai.channelCount = 2;
        ai.channelLabels = ["left", "right"];
        ai.sampleRate = audioInfo.sampleRate;
        ai.totalSamples = audioInfo.totalSamples;
        this.audioInfo = ai;
        this.sampleRate = ai.sampleRate;
        this.totalSamples = ai.totalSamples;

        this.channelMuted = [false, false];
        this.mimeType = "audio/mpeg";
        this.BITRATE = 128;
        this.mp3 = new Mp3Encoder(2, audioInfo.sampleRate, 128);
        this.frameCount = Math.ceil(this.totalSamples / 1152.0) | 0;
        this.segmentCount = Math.ceil(this.frameCount / Mp3StereoSegmentedAudioStream.framesPerSegment) | 0;
    }

    silenceAppended(): boolean {
        return false;
    }

    //Mp3StereoSegmentedAudioStream doesnt grow or change seekable segments on the fly
    isDynamic(): boolean {
        return false;
    }

    getDashInit(onDone: (arg: ArrayBuffer) => void, onError: (arg: XMLHttpRequest) => void) {
        onDone(null);
    }

    getSegmentCount(): number {
        return this.segmentCount;
    }

    loadSegment(segmentIdx: number, onDone: (arg: ArrayBuffer) => void, onError: (arg: Object) => void): () => void {
        console.log("loadSegment", segmentIdx);
        let sps = Mp3StereoSegmentedAudioStream.samplesPerSegment;
        let subscribe = this.samples.readStereo(sps, segmentIdx * sps).take(1).map(it => {
            console.log("readStereo", it.range, it.samples);
            let left = scale32k(it.samples[0]);
            let right = it.samples[0];
            if (left === right) {
                right = scale32k(right);
            }
            let body = this.mp3.encodeSamples(left, right);
            let tail = this.mp3.flush();
            let concat = new Int8Array(body.length + tail.length);
            concat.set(body, 0);
            concat.set(tail, body.length);
            console.log("encode", it.range, it.samples, concat.byteLength);
            return concat.buffer;
        }).subscribe(mp3buf => onDone(mp3buf), err => {
            console.log("error", err);
            onError(err);
        });

        let abort = () => subscribe.dispose();
        return abort;
    }

    getDurationSec(): number {
        return this.audioInfo.totalSamples / this.audioInfo.sampleRate
    }

    getSegmentIdxByTime(time: number): number {
        let sample = (time * this.sampleRate) | 0;
        let frame = sample / 1152;
        return (frame / Mp3StereoSegmentedAudioStream.framesPerSegment) | 0;
    }

    getSegmentStartTime(idx: number): number {
        return (idx * Mp3StereoSegmentedAudioStream.samplesPerSegment / this.sampleRate)
    }

    getSegmentDuration(idx: number): number {
        return (Mp3StereoSegmentedAudioStream.samplesPerSegment / this.sampleRate)
    }

}