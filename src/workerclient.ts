import {com} from "konform";
import FastAudioIndex = com.vg.audio.FastAudioIndex;
import Observable = Rx.Observable;
import TransferableIndex = com.vg.audio.TransferableIndex;

export interface MatchJob {
    idx1: TransferableIndex;
    idx2: TransferableIndex;
}

export interface MatchResponse {
    best: number;
}

export class WorkerClient {
    private readonly workers: Worker[];

    private workernum = 0;
    constructor(workers: Worker[]) {
        this.workers = workers;
    }

    public matchOffsets(idx1: FastAudioIndex, idx2: FastAudioIndex): Observable<MatchResponse> {
        this.workernum = this.workernum % this.workers.length;
        const wid = this.workernum;
        this.workernum++;
        return matchWithWorker(this.workers[wid], idx1, idx2);
    }
}

function matchWithWorker(worker: Worker, idx1: FastAudioIndex, idx2: FastAudioIndex): Observable<MatchResponse> {
    return Observable.create<MessageEvent>((emitter) => {
        const job: MatchJob = {idx1: idx1.toTransferable(), idx2: idx2.toTransferable()};
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
    }).map(me => (me.data as MatchResponse));
}
