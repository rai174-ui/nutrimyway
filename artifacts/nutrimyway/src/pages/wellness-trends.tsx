import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";

export default function WellnessTrends() {
  const { data: articles, isLoading, error } = useQuery({
    queryKey: ["wellness-articles"],
    queryFn: async () => {
      const res = await fetch("/api/wellness-articles?limit=50");
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json() as Promise<Array<{
        id: number;
        title: string;
        description: string;
        link: string;
        source: string;
        pub_date: string;
        image_url: string;
      }>>;
    }
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/logo.png" alt="NutriMyWay" className="h-8 w-auto" />
            <span className="font-bold sm:inline-block">NutriMyWay</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <a href="/login" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              Member Login
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl mb-4">
            Health, Nutrition & Wellness Trends
          </h1>
          <p className="text-lg text-muted-foreground">
            Stay up to date with the latest research, diet trends, and fitness advice from trusted medical sources.
          </p>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col gap-4">
                <div className="w-full aspect-video bg-muted rounded-xl" />
                <div className="h-6 w-3/4 bg-muted rounded" />
                <div className="h-4 w-1/4 bg-muted rounded" />
                <div className="h-16 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
            <p>Failed to load the latest trends. Please check back later.</p>
          </div>
        )}

        {articles && articles.length === 0 && (
          <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
            <p>No wellness articles available yet. They are currently being synced!</p>
          </div>
        )}

        {articles && articles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => (
              <a 
                key={article.id} 
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-xl overflow-hidden border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all hover:border-primary/50"
              >
                {article.image_url ? (
                  <div className="w-full aspect-video overflow-hidden bg-muted relative">
                    <img 
                      src={article.image_url} 
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-primary/5 text-primary/40 group-hover:bg-primary/10 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  </div>
                )}
                
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary mb-3">
                    <span className="bg-primary/10 px-2 py-1 rounded-md">{article.source}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(article.pub_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-3">
                    {article.title}
                  </h3>
                  
                  <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-grow">
                    {article.description.replace(/<[^>]*>?/gm, '')}
                  </p>
                  
                  <div className="mt-auto flex items-center text-sm font-semibold text-primary">
                    Read article
                    <svg className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
