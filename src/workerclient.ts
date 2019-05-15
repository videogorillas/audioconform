import {com} from "konform";
import FastAudioIndex = com.vg.audio.FastAudioIndex;
import Observable = Rx.Observable;
import TransferableIndex = com.vg.audio.TransferableIndex;

export interface IndexJob {
    idx1: TransferableIndex;
    idx2: TransferableIndex;
}

export interface IndexResponse {
    best: number;
}

export function indexWithWorker(worker: Worker, idx1: FastAudioIndex, idx2: FastAudioIndex): Observable<IndexResponse> {
    const job: IndexJob = {idx1: idx1.toTransferable(), idx2: idx2.toTransferable()};
    let messages = Observable.create<MessageEvent>((emitter) => {
        worker.postMessage(job);
        const listener = (e: MessageEvent) => {
            console.log("from worker", e);
            emitter.onNext(e);
            emitter.onCompleted();
        };
        const errorListener = (e: MessageEvent) => {
            console.log("error from worker", e);
            emitter.onError(e);
        };
        worker.addEventListener("message", listener);
        worker.addEventListener("error", errorListener);
        return () => {
            worker.removeEventListener("message", listener);
            worker.removeEventListener("error", errorListener);
        };
    });
    return messages.map(me => {
        console.log("message from worker", me);
        return me.data as IndexResponse;
    });
}
