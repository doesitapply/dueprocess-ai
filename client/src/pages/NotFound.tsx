import {
  CommandCard,
  CommandCardBody,
  CommandSurface,
} from "@/components/command-ui";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <CommandSurface>
      <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
        <CommandCard className="w-full max-w-lg">
          <CommandCardBody className="py-10 text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse" />
                <AlertCircle className="relative h-16 w-16 text-red-500" />
              </div>
            </div>

            <h1 className="mb-2 text-4xl font-bold text-zinc-950 dark:text-white">
              404
            </h1>

            <h2 className="mb-4 text-xl font-semibold text-zinc-700 dark:text-slate-300">
              Page Not Found
            </h2>

            <p className="mb-8 leading-relaxed text-zinc-600 dark:text-slate-400">
              Sorry, the page you are looking for doesn't exist.
              <br />
              It may have been moved or deleted.
            </p>

            <div
              id="not-found-button-group"
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button
                onClick={handleGoHome}
                className="bg-zinc-950 px-6 py-2.5 text-white hover:bg-zinc-800 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </CommandCardBody>
        </CommandCard>
      </div>
    </CommandSurface>
  );
}
