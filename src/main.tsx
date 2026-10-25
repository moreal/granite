import { render } from "@solidjs/web";
import App from "./App";
import { initializeTheme } from "./settings";
import "./styles.css";
initializeTheme();
render(() => <App />, document.getElementById("root")!);
