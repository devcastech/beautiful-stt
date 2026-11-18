import { useState } from "react";
import "./App.css";
import { AudioProcessor } from "./AudioProcessor";
import Layout from "./layout";
import { Settings } from "./views/settings/Settings";

function App() {
  const [tab, _setTab] = useState("transcript");
  return (
    <Layout>
      {tab === "transcript" && <AudioProcessor />}
      {tab === "settings" && <Settings />}
    </Layout>
  );
}

export default App;
