import * as React from "react";
import * as ReactDOM from "react-dom";
import AudioConformApp from "./AudioConformApp";
import {newSampleRange} from "./utils";
import {WorkerClient} from "./workerclient";
import {Long} from "kotlin";
import PersistentDrawerLeft from "./DrawerLeft";

(window as any)["newSampleRange"] = newSampleRange;
(window as any)["KotlinLong"] = Long;
const cpus = 1 //navigator.hardwareConcurrency || 1;
const workers: Worker[] = [];
for (let i = 0; i < cpus; i++) {
    workers[i] = new Worker("build/worker.bundle.js");
}

for (let i = 0; i < cpus; i++) {
    workers[i].postMessage(`hello worker ${i}`);
}

ReactDOM.render(
    <AudioConformApp workerClient={new WorkerClient(workers)}/>
    ,
    document.getElementById("app"),
);
