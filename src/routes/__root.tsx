import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../components/auth/AuthProvider";
import { AuthModal } from "../components/auth/AuthModal";
import { UserMenu } from "../components/auth/UserMenu";

import appCss from "../styles.css?url";
import { CookieBanner } from "../components/CookieBanner";
import { Sidebar } from "../components/Sidebar";
import { SponsorNotice } from "../components/SponsorNotice";
import { PWAInstallPrompt } from "../components/PWAInstallPrompt";
import { adManager } from "../lib/adManager";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  // `error` é `unknown` no contrato do router: normaliza para log sem assumir
  // Error (um throw de string ou objeto também cai aqui).
  const erro = error instanceof Error ? error : new Error(String(error));
  console.error(erro);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cidadela do Pracinha | Jogos online, testes de QI, jogos de estratégia, estudo, conhecimento e comunidade" },
      {
        name: "description",
        content:
          "Cidadela do Pracinha | Jogos online, testes de QI, jogos de estratégia, estudo, conhecimento e comunidade.",
      },
      {
        name: "keywords",
        content: "jogos, jogos online, QI, teste de QI, estratégia, comunidade, estudo, conhecimento, cidadela do pracinha, pracinha jogos",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Cidadela do Pracinha | Jogos online, testes de QI, jogos de estratégia, estudo, conhecimento e comunidade" },
      {
        property: "og:description",
        content:
          "Cidadela do Pracinha | Jogos online, testes de QI, jogos de estratégia, estudo, conhecimento e comunidade.",
      },
      { property: "og:url", content: "https://pracinha.online" },
      { property: "og:image", content: "https://pracinha.online/artes/cidadela-icon-og.jpeg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cidadela do Pracinha | Teste de QI, Jogos e Campus" },
      {
        name: "twitter:description",
        content:
          "Teste seu raciocínio, explore jogos estratégicos e descubra o Campus. Cidadela do Pracinha: inteligência, jogos e comunidade.",
      },
      { name: "twitter:image", content: "https://pracinha.online/artes/cidadela-icon-og.jpeg" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;900&family=Plus+Jakarta+Sans:wght@400;500;700&display=swap",
      },
      { rel: "icon", href: "/artes/cidadela-favicon.ico", type: "image/x-icon" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/artes/cidadela-icon-192.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="min-h-screen">
          <Sidebar />
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Carrega a rede de anúncios correta para cada rota
  // (Adsterra=/botao, Monetag=/trilha,/cidadela, AdSense=páginas estáticas).
  useEffect(() => {
    adManager.initForRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    // Google Analytics
    const script1 = document.createElement("script");
    script1.async = true;
    script1.src = "https://www.googletagmanager.com/gtag/js?id=G-64FCC805LH";
    document.head.appendChild(script1);

    const script2 = document.createElement("script");
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-64FCC805LH');
    `;
    document.head.appendChild(script2);

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthShell() {
  const { tipoModal, fecharLogin, aplicarPerfilGlobal, perfil } = useAuth();
  return (
    <>
      <Outlet />
      <UserMenu />
      <AuthModal
        tipo={tipoModal}
        onFechar={fecharLogin}
        onLogin={(p) => {
          if (p) aplicarPerfilGlobal(p);
          else fecharLogin();
        }}
        perfil={perfil}
      />
      <CookieBanner />
      <SponsorNotice />
      <PWAInstallPrompt />
    </>
  );
}
