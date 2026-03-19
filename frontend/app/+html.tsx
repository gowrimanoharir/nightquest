import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Injected into the static HTML shell for web builds.
// Sets the dark background at the document level so there's no white flash.
export default function HTML({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              background-color: #050508 !important;
              color: #F5F0E8;
              height: 100%;
              margin: 0;
              padding: 0;
              -webkit-font-smoothing: antialiased;
            }
            * { box-sizing: border-box; }
            /* Custom scrollbar — Atacama theme */
            * { scrollbar-width: thin; scrollbar-color: #2A1F18 transparent; }
            *::-webkit-scrollbar { width: 8px; height: 8px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb {
              background: #2A1F18;
              border-radius: 4px;
              border: 2px solid transparent;
              background-clip: padding-box;
            }
            *::-webkit-scrollbar-thumb:hover { background: #3D2E22; }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
