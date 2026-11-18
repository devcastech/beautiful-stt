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
      <div hidden={view !== VIEWS.transcript}>
        <AudioProcessor />
      </div>
      {view === VIEWS.settings && <Settings />}
    </>
  );
}

export default App;
