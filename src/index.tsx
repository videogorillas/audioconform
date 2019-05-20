import * as React from "react";
import * as ReactDOM from "react-dom";
import AudioConformApp from "./AudioConformApp";
import {newSampleRange} from "./utils";
import {WorkerClient} from "./workerclient";
import {Long} from "kotlin";
import MuiThemeProvider from "@material-ui/core/styles/MuiThemeProvider";
import CssBaseline from "@material-ui/core/CssBaseline";
import createMuiTheme from "@material-ui/core/styles/createMuiTheme";

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
const theme = createMuiTheme({
    palette: {
        type: "dark",
    },
});
ReactDOM.render(
    <MuiThemeProvider theme={theme}>
        <CssBaseline/>
        <AudioConformApp workerClient={new WorkerClient(workers)}/>
    </MuiThemeProvider>
    ,
    document.getElementById("app"),
);
