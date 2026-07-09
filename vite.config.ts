import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

function analyzeDocumentsApiPlugin(): Plugin {
  return {
    name: 'credit-risk-analyze-documents-api',
    configureServer(server) {
      server.middlewares.use(
        '/api/analyze-documents',
        (req, res, next) => {
          if (req.method !== 'POST') {
            next()
            return
          }

          void import('./server/analyze-documents')
            .then(({ handleAnalyzeDocuments }) =>
              handleAnalyzeDocuments(
                req as IncomingMessage,
                res as ServerResponse,
              ),
            )
            .catch(next)
        },
      )

      server.middlewares.use(
        '/api/analyze-coface',
        (req, res, next) => {
          if (req.method !== 'POST') {
            next()
            return
          }

          void import('./server/analyze-coface-document')
            .then(({ handleAnalyzeCofaceDocument }) =>
              handleAnalyzeCofaceDocument(
                req as IncomingMessage,
                res as ServerResponse,
              ),
            )
            .catch(next)
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), analyzeDocumentsApiPlugin()],
})
