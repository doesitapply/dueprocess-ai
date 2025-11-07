import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Link } from "wouter";
import { Scale, Sparkles, TrendingUp, Zap } from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <h1 className="text-xl font-bold text-white">{APP_TITLE}</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing">
              <Button variant="outline">Pricing</Button>
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="default">Go to Dashboard</Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button variant="default">Sign In</Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              <span>Powered by AI Agents</span>
            </div>
            
            <h2 className="text-5xl md:text-6xl font-bold text-white leading-tight">
              Transform Court Documents into
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"> Actionable Intelligence</span>
            </h2>
            
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Upload legal transcripts and let our three specialized AI agents—Justice Jester, Law Clerk, and Hobot—generate viral content, legal analysis, and monetization strategies in minutes.
            </p>

            <div className="flex gap-4 justify-center pt-4">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="text-lg px-8">
                    Launch Dashboard
                  </Button>
                </Link>
              ) : (
                <a href={getLoginUrl()}>
                  <Button size="lg" className="text-lg px-8">
                    Get Started Free
                  </Button>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <CardTitle className="text-white">Justice Jester</CardTitle>
                <CardDescription className="text-slate-400">
                  Viral Content Generator
                </CardDescription>
              </CardHeader>
              <CardContent className="text-slate-300">
                Creates meme captions, TikTok scripts, and satirical soundbites that turn legal proceedings into shareable content.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <Scale className="w-6 h-6 text-blue-400" />
                </div>
                <CardTitle className="text-white">Law Clerk</CardTitle>
                <CardDescription className="text-slate-400">
                  Legal Analysis Engine
                </CardDescription>
              </CardHeader>
              <CardContent className="text-slate-300">
                Extracts violations, cites relevant case law, and drafts motions including §1983 and ADA filings.
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <CardTitle className="text-white">Hobot</CardTitle>
                <CardDescription className="text-slate-400">
                  Monetization Strategist
                </CardDescription>
              </CardHeader>
              <CardContent className="text-slate-300">
                Transforms legal outputs into digital products, merch drops, and legal toolkits for revenue generation.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-3xl font-bold text-white text-center mb-12">
              Three Simple Steps
            </h3>
            
            <div className="space-y-8">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500/10 border-2 border-blue-500 flex items-center justify-center text-blue-400 font-bold text-lg">
                  1
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white mb-2">Upload Document</h4>
                  <p className="text-slate-400">Upload your court transcript, deposition, or legal document in any format.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500/10 border-2 border-purple-500 flex items-center justify-center text-purple-400 font-bold text-lg">
                  2
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white mb-2">AI Processing</h4>
                  <p className="text-slate-400">Our three specialized agents analyze your document simultaneously in seconds.</p>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center text-green-400 font-bold text-lg">
                  3
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-white mb-2">Get Results</h4>
                  <p className="text-slate-400">Receive viral content, legal analysis, and monetization strategies in one dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-12">
            <h3 className="text-3xl font-bold text-white mb-4">
              Ready to Transform Your Legal Documents?
            </h3>
            <p className="text-slate-400 mb-8 text-lg">
              Join the future of legal document processing with AI-powered intelligence.
            </p>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" className="text-lg px-8">
                  Start Processing Now
                </Button>
              </a>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/50">
        <div className="container mx-auto px-4 py-8 text-center text-slate-500 text-sm">
          <p>© 2025 {APP_TITLE}. Built with Manus AI.</p>
        </div>
      </footer>
    </div>
  );
}

