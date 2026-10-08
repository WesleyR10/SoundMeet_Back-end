import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import {
  ContractCertificateRenderInput,
  ContractRenderInput,
  IContractRenderer,
  RenderedDocument,
} from "../../application/ports/contract-renderer.port";
import {
  ContractCertificateDocument,
  ContractDocument,
} from "./contract-pdf.document";

/**
 * Adapter de renderização em PDF.
 *
 * `@react-pdf/renderer` gera o PDF **sem browser**: pôr Chromium na imagem
 * custaria mais de 300 MB e um processo a mais para manter de pé, e o
 * `tsconfig.json` já compila JSX porque os templates de e-mail deste projeto
 * são React renderizado no servidor.
 *
 * O adapter é fino de propósito — só conhece a porta e o `renderToBuffer`. O
 * layout mora em `contract-pdf.document.tsx`.
 */
export class ReactPdfContractRenderer implements IContractRenderer {
  async renderContract(input: ContractRenderInput): Promise<RenderedDocument> {
    const data = await renderToBuffer(
      React.createElement(ContractDocument, { input }) as any,
    );

    return {
      data: Buffer.from(data),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  }

  async renderSignatureCertificate(
    input: ContractCertificateRenderInput,
  ): Promise<RenderedDocument> {
    const data = await renderToBuffer(
      React.createElement(ContractCertificateDocument, { input }) as any,
    );

    return {
      data: Buffer.from(data),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  }
}
