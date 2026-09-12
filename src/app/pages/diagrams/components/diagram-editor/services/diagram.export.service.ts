import { Injectable } from '@angular/core';
import {
  DiagramExportFormat,
  DiagramExportOptions,
} from '../../../../../core/models/diagram.model';
@Injectable({
  providedIn: 'root',
})
export class DiagramExportService {
  async export(element: HTMLElement, name: string, options: DiagramExportOptions): Promise<void> {
    switch (options.format) {
      case 'svg':
        this.exportSvg(element, name, options);
        return;
      case 'png':
        await this.exportPng(element, name, options);
        return;
      case 'pdf':
        await this.exportPdf(element, name, options);
        return;
    }
  }
  getBounds(element: HTMLElement): {
    width: number;
    height: number;
  } {
    const width = Math.max(
      element.scrollWidth,
      element.clientWidth,
      element.getBoundingClientRect().width,
    );
    const height = Math.max(
      element.scrollHeight,
      element.clientHeight,
      element.getBoundingClientRect().height,
    );
    return {
      width: Math.ceil(width),
      height: Math.ceil(height),
    };
  }
  private exportSvg(element: HTMLElement, name: string, options: DiagramExportOptions): void {
    const svg = this.createSvgDocument(element, options);
    const blob = new Blob([svg], {
      type: 'image/svg+xml;charset=utf-8',
    });
    this.download(blob, `${this.normalizeFileName(name)}.svg`);
  }
  private async exportPng(
    element: HTMLElement,
    name: string,
    options: DiagramExportOptions,
  ): Promise<void> {
    const svg = this.createSvgDocument(element, options);
    const svgBlob = new Blob([svg], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await this.loadImage(url);
      const bounds = this.getBounds(element);
      const scale = Math.max(1, options.scale || 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(bounds.width * scale);
      canvas.height = Math.ceil(bounds.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to create export canvas.');
      if (options.background) {
        context.fillStyle = this.getBackgroundColor(element);
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, bounds.width, bounds.height);
      const blob = await this.canvasToBlob(canvas, 'image/png');
      this.download(blob, `${this.normalizeFileName(name)}.png`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  private async exportPdf(
    element: HTMLElement,
    name: string,
    options: DiagramExportOptions,
  ): Promise<void> {
    const svg = this.createSvgDocument(element, {
      ...options,
      background: true,
    });
    const svgBlob = new Blob([svg], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await this.loadImage(url);
      const bounds = this.getBounds(element);
      const scale = Math.max(1, options.scale || 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(bounds.width * scale);
      canvas.height = Math.ceil(bounds.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to create PDF canvas.');
      context.fillStyle = this.getBackgroundColor(element);
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(scale, scale);
      context.drawImage(image, 0, 0, bounds.width, bounds.height);
      const jpeg = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = this.createPdf(jpeg, canvas.width, canvas.height);
      this.download(pdf, `${this.normalizeFileName(name)}.pdf`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  private createSvgDocument(element: HTMLElement, options: DiagramExportOptions): string {
    const bounds = this.getBounds(element);
    const clone = element.cloneNode(true) as HTMLElement;
    this.removeEditorControls(clone);
    this.inlineStyles(element, clone);
    clone.style.transform = 'none';
    clone.style.width = `${bounds.width}px`;
    clone.style.height = `${bounds.height}px`;
    clone.style.overflow = 'visible';
    const serializer = new XMLSerializer();
    const html = serializer.serializeToString(clone);
    const background = options.background
      ? `<rect width="100%" height="100%" fill="${this.escapeXml(this.getBackgroundColor(element))}"/>`
      : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">${background}<foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${bounds.width}px;height:${bounds.height}px;">${html}</div></foreignObject></svg>`;
  }
  private inlineStyles(source: Element, target: Element): void {
    const sourceElements = [source, ...Array.from(source.querySelectorAll('*'))];
    const targetElements = [target, ...Array.from(target.querySelectorAll('*'))];
    sourceElements.forEach((sourceElement, index) => {
      const targetElement = targetElements[index] as HTMLElement | undefined;
      if (!targetElement) return;
      const computed = getComputedStyle(sourceElement);
      const css = Array.from(computed)
        .map((property) => `${property}:${computed.getPropertyValue(property)};`)
        .join('');
      targetElement.setAttribute('style', `${targetElement.getAttribute('style') || ''}${css}`);
    });
  }
  private removeEditorControls(element: HTMLElement): void {
    element
      .querySelectorAll(
        '.connector-port,.resize-handle,.connection-endpoint,.connection-bend,.diagram-marquee,.node-actions,.connection-actions',
      )
      .forEach((item) => item.remove());
    element.querySelectorAll('.selected').forEach((item) => {
      item.classList.remove('selected');
    });
    element.querySelectorAll('.editing').forEach((item) => {
      item.classList.remove('editing');
    });
  }
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to render diagram export.'));
      image.src = url;
    });
  }
  private canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('Unable to create exported image.'));
      }, type);
    });
  }
  private createPdf(dataUrl: string, width: number, height: number): Blob {
    const imageBytes = this.dataUrlToBytes(dataUrl);
    const landscape = width >= height;
    const pageWidth = landscape ? 842 : 595;
    const pageHeight = landscape ? 595 : 842;
    const margin = 24;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;
    const ratio = Math.min(availableWidth / width, availableHeight / height);
    const imageWidth = width * ratio;
    const imageHeight = height * ratio;
    const x = (pageWidth - imageWidth) / 2;
    const y = (pageHeight - imageHeight) / 2;
    const encoder = new TextEncoder();
    const objects: Uint8Array[] = [];
    const offsets: number[] = [];
    const pushText = (value: string) => objects.push(encoder.encode(value));
    pushText('%PDF-1.4\n');
    pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    pushText(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    );
    const imageHeader = encoder.encode(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    );
    const imageFooter = encoder.encode('\nendstream\nendobj\n');
    objects.push(this.concatBytes(imageHeader, imageBytes, imageFooter));
    const content = `q\n${imageWidth} 0 0 ${imageHeight} ${x} ${y} cm\n/Im0 Do\nQ`;
    pushText(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    let position = 0;
    const chunks: Uint8Array[] = [];
    objects.forEach((object, index) => {
      if (index > 0) offsets.push(position);
      chunks.push(object);
      position += object.length;
    });
    const xrefPosition = position;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    offsets.forEach((offset) => {
      xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });
    xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
    chunks.push(encoder.encode(xref));
    return new Blob(chunks as BlobPart[], {
      type: 'application/pdf',
    });
  }
  private dataUrlToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  private concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const length = arrays.reduce((total, array) => total + array.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    arrays.forEach((array) => {
      result.set(array, offset);
      offset += array.length;
    });
    return result;
  }
  private getBackgroundColor(element: HTMLElement): string {
    const background = getComputedStyle(element).backgroundColor;
    if (!background || background === 'transparent' || background === 'rgba(0, 0, 0, 0)') {
      return '#ffffff';
    }
    return background;
  }
  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  private normalizeFileName(name: string): string {
    return (
      name
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase() || 'diagram'
    );
  }
  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
