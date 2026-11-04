declare module 'mammoth/mammoth.browser.js' {
  interface Message {
    type: 'warning' | 'error';
    message: string;
  }
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: Message[] }>;
}

declare module 'html-to-pdfmake' {
  export default function htmlToPdfmake(html: string, options?: { window?: Window; tableAutoSize?: boolean; defaultStyles?: Record<string, unknown> }): unknown;
}
