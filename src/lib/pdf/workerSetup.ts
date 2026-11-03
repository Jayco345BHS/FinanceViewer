/**
 * Browser-only pdf.js worker setup. Imported once by the app entry point;
 * kept out of extract.ts so Node scripts/tests can import it without the
 * Vite-specific `?url` suffix.
 */
import { GlobalWorkerOptions } from 'pdfjs-dist';
// `?worker&url` gives a URL served with the correct module MIME type and
// lets Vite bundle the worker properly (plain `?url` makes pdf.js fall back
// to a "fake worker" that does a runtime import() of the URL, which fails
// under strict module MIME checking).
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';

GlobalWorkerOptions.workerSrc = workerUrl;
