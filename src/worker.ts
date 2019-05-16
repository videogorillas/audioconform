import {com} from "konform";
import {MatchJob} from "./workerclient";
import indexFromTransferable = com.vg.audio.indexFromTransferable;

console.log("worker ready");

onmessage = me => {
    console.log("onmessage", me);
    if (typeof me.data === "object") {
        const job: MatchJob = me.data;
        const match = com.vg.audio.matchOffsets(indexFromTransferable(job.idx1), indexFromTransferable(job.idx2));
        const best = com.vg.audio.bestOffset(match);
        console.log("match", match, best);
        postMessage({best: best.toNumber()});
    }
};
