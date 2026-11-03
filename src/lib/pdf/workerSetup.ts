/**
 * Browser-only pdf.js worker setup. Imported once by the app entry point;
 * kept out of extract.ts so Node scripts/tests can import it without the
 * Vite-specific `?url` suffix.
 */
import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;
