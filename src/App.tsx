import "./App.css";
import { AudioProcessor } from "./views/transcript/AudioProcessor";
import Layout from "./layout";
import { Settings } from "./views/settings/Settings";
import { VIEWS, ViewProvider, useView } from "./hooks/useView";

function App() {
  return (
    <ViewProvider>
      <Layout>
        <Views />
      </Layout>
    </ViewProvider>
  );
}

function Views() {
  const { view } = useView();
  return (
    <>
      <div hidden={view !== VIEWS.transcript} className="h-full">
        <AudioProcessor />
      </div>
      <div hidden={view !== VIEWS.settings} className="h-full">
        <Settings />
      </div>
    </>
  );
}

export default App;
