import {com} from "konform";
import SampleRange = com.vg.audio.SampleRange;
import {Long} from "kotlin";

export const live4red = "#ee2737";
export const live4blue = "#2196f3";

export function newSampleRange(start: number, end: number): SampleRange {
    return new SampleRange(Long.fromNumber(start), Long.fromNumber(end));
}

export function fileKey(file: File): string {
    return (file as any).webkitRelativePath || file.name;
}


export function resample() {

    // e.inputBuffer;  // directly received by the audioprocess event from the microphone in the browser

    const TARGET_SAMPLE_RATE = 48000;
    const offlineCtx = new OfflineAudioContext(1, 48000, TARGET_SAMPLE_RATE);
    const sourceAudioBuffer = offlineCtx.createBuffer(1, 47952, 47952);
    console.log(sourceAudioBuffer);
    const buffer = offlineCtx.createBuffer(sourceAudioBuffer.numberOfChannels, sourceAudioBuffer.length, sourceAudioBuffer.sampleRate);
// Copy the source data into the offline AudioBuffer
    for (let channel = 0; channel < sourceAudioBuffer.numberOfChannels; channel++) {
        buffer.copyToChannel(sourceAudioBuffer.getChannelData(channel), channel);
    }
// Play it from the beginning.
    const source = offlineCtx.createBufferSource();
    source.buffer = sourceAudioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    offlineCtx.oncomplete = (e) => {
        // `resampled` contains an AudioBuffer resampled at 16000Hz.
        // use resampled.getChannelData(x) to get an Float32Array for channel x.
        const resampled = e.renderedBuffer;
        const leftFloat32Array = resampled.getChannelData(0);
        // use this float32array to send the samples to the server or whatever
        console.log(leftFloat32Array);
    };
    offlineCtx.startRendering();
}
