import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ThemeProvider } from './context/theme';
import { ToastProvider } from './context/toast';
import { SessionProvider } from './context/session';
import Home from './pages/Home';

const pages = () => import('./pages/Pages');
const CategoryPage = lazy(() => pages().then((m) => ({ default: m.CategoryPage })));
const About = lazy(() => pages().then((m) => ({ default: m.About })));
const Contact = lazy(() => pages().then((m) => ({ default: m.Contact })));
const Privacy = lazy(() => pages().then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => pages().then((m) => ({ default: m.Terms })));
const NotFound = lazy(() => pages().then((m) => ({ default: m.NotFound })));

// Tool pages are code-split so PDF libraries only load when a tool is opened.
const ImageToPdf = lazy(() => import('./tools/ImageToPdf'));
const PdfToImage = lazy(() => import('./tools/PdfToImage'));
const MergePdf = lazy(() => import('./tools/MergePdf'));
const SplitPdf = lazy(() => import('./tools/SplitPdf'));
const CompressPdf = lazy(() => import('./tools/CompressPdf'));
const PdfPagesTool = lazy(() => import('./tools/PdfPagesTool'));
const ExtractImages = lazy(() => import('./tools/ExtractImages'));
const ConvertImage = lazy(() => import('./tools/ConvertImage'));
const CompressImage = lazy(() => import('./tools/CompressImage'));
const ResizeImage = lazy(() => import('./tools/ResizeImage'));
const CropImage = lazy(() => import('./tools/CropImage'));
const RotateImage = lazy(() => import('./tools/RotateImage'));
const WordToPdf = lazy(() => import('./tools/WordToPdf'));
const PdfToWord = lazy(() => import('./tools/PdfToWord'));

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SessionProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="pdf-tools" element={<CategoryPage category="pdf" />} />
                <Route path="image-tools" element={<CategoryPage category="image" />} />
                <Route path="about" element={<About />} />
                <Route path="contact" element={<Contact />} />
                <Route path="privacy" element={<Privacy />} />
                <Route path="terms" element={<Terms />} />

                <Route path="image-to-pdf" element={<ImageToPdf />} />
                <Route path="word-to-pdf" element={<WordToPdf />} />
                <Route path="pdf-to-word" element={<PdfToWord />} />
                <Route path="pdf-to-jpg" element={<PdfToImage key="jpg" format="jpg" />} />
                <Route path="pdf-to-png" element={<PdfToImage key="png" format="png" />} />
                <Route path="merge-pdf" element={<MergePdf />} />
                <Route path="split-pdf" element={<SplitPdf />} />
                <Route path="compress-pdf" element={<CompressPdf />} />
                <Route path="rotate-pdf" element={<PdfPagesTool key="rotate" mode="rotate" />} />
                <Route path="delete-pages" element={<PdfPagesTool key="delete" mode="delete" />} />
                <Route path="organize-pdf" element={<PdfPagesTool key="organize" mode="organize" />} />
                <Route path="extract-images" element={<ExtractImages />} />
                {(['jpg-to-png', 'png-to-jpg', 'webp-to-jpg', 'webp-to-png'] as const).map((p) => (
                  <Route key={p} path={p} element={<ConvertImage key={p} preset={p} />} />
                ))}
                <Route path="compress-image" element={<CompressImage />} />
                <Route path="resize-image" element={<ResizeImage />} />
                <Route path="crop-image" element={<CropImage />} />
                <Route path="rotate-image" element={<RotateImage />} />

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
