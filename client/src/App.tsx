import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ProcessDocument from "./pages/ProcessDocument";
import Pricing from "./pages/Pricing";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import TacticalOps from "./pages/sectors/TacticalOps";
import IntelCenter from "./pages/sectors/IntelCenter";
import LegalArsenal from "./pages/sectors/LegalArsenal";
import EvidenceLab from "./pages/sectors/EvidenceLab";
import OffensiveOps from "./pages/sectors/OffensiveOps";
import IntegrationsHub from "./pages/sectors/IntegrationsHub";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/payments"} component={Payments} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/process/:id"} component={ProcessDocument} />
      <Route path={"/sector/tactical"} component={TacticalOps} />
      <Route path={"/sector/intel"} component={IntelCenter} />
      <Route path={"/sector/arsenal"} component={LegalArsenal} />
      <Route path={"/sector/evidence"} component={EvidenceLab} />
      <Route path={"/sector/offensive"} component={OffensiveOps} />
      <Route path={"/sector/integrations"} component={IntegrationsHub} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

