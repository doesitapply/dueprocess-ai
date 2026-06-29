import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProcessDocument = lazy(() => import("./pages/ProcessDocument"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Payments = lazy(() => import("./pages/Payments"));
const Settings = lazy(() => import("./pages/Settings"));
const TacticalOps = lazy(() => import("./pages/sectors/TacticalOps"));
const IntelCenter = lazy(() => import("./pages/sectors/IntelCenter"));
const LegalArsenal = lazy(() => import("./pages/sectors/LegalArsenal"));
const EvidenceLab = lazy(() => import("./pages/sectors/EvidenceLab"));
const OffensiveOps = lazy(() => import("./pages/sectors/OffensiveOps"));
const IntegrationsHub = lazy(() => import("./pages/sectors/IntegrationsHub"));
const CorpusCenter = lazy(() => import("./pages/sectors/CorpusCenter"));
const Reports = lazy(() => import("./pages/Reports"));
const Violations = lazy(() => import("./pages/Violations"));
const MarketCommand = lazy(() => import("./pages/MarketCommand"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a0d] px-6 text-slate-100">
      <div className="rounded-md border border-white/10 bg-white/[0.04] px-5 py-4 shadow-sm">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-300">
          DueProcess AI
        </p>
        <p className="mt-2 text-sm text-slate-400">Loading command surface</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/payments"} component={Payments} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/violations"} component={Violations} />
      <Route path={"/market"} component={MarketCommand} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/process/:id"} component={ProcessDocument} />
      <Route path={"/sector/tactical"} component={TacticalOps} />
      <Route path={"/sector/intel"} component={IntelCenter} />
      <Route path={"/sector/arsenal"} component={LegalArsenal} />
      <Route path={"/sector/evidence"} component={EvidenceLab} />
      <Route path={"/sector/offensive"} component={OffensiveOps} />
      <Route path={"/sector/integrations"} component={IntegrationsHub} />
      <Route path={"/sector/corpus"} component={CorpusCenter} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<RouteLoading />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
