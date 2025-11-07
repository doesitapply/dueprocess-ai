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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/pricing"} component={Pricing} />
      <Route path={"/payments"} component={Payments} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/process/:id"} component={ProcessDocument} />
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

